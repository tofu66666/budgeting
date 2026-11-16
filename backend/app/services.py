import json
import re
from datetime import date, datetime
from typing import Any

import google.generativeai as genai

from app.auth import get_password_hash
from app.config import get_settings
from app.database import get_supabase_client
from app.models import AppSettings, RecurringExpense, SpendEntry

settings = get_settings()


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("Gemini returned an empty response")

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text, flags=re.IGNORECASE)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini response was not valid JSON: {text[:500]}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Gemini response must be a JSON object")
    return payload


DEFAULT_RECEIPT_SYSTEM_PROMPT = (
    "You are an expert financial receipt analysis assistant.\n"
    "Carefully inspect the receipt image and extract transaction data with high precision.\n\n"
    "Instructions:\n"
    "1. Date: Find the transaction/purchase date printed on the receipt and format it strictly as ISO 'YYYY-MM-DD' (e.g. '2026-11-15'). If the year is 2 digits, infer the 4-digit year. If no date is visible or legible on the receipt, output null.\n"
    "2. Merchant: Extract the store, restaurant, vendor, or business name (e.g., 'Target', 'Trader Joe\\'s', 'Shell Gas', 'Costco'). If unreadable, use 'Unknown Merchant'.\n"
    "3. Line Items: Extract each individual purchased item with its exact name/description, sensible budget category (such as 'Groceries', 'Dining & Food', 'Utilities', 'Transportation', 'Housing', 'Healthcare', 'Entertainment', 'Shopping', 'Personal Care', 'Other'), and numeric price/amount.\n"
    "4. Adjustments & Discounts: Capture coupons, discounts, returns, or bottle deposits as separate line items with negative amounts (e.g. -1.50).\n"
    "5. Categories: Return a dictionary mapping each budget category name to its subtotal amount.\n"
    "6. Total Spend: Extract or calculate the grand total paid on the receipt.\n"
    "7. Notes: Provide a concise 1-sentence summary of the transaction (e.g., 'Groceries at Trader Joe\\'s').\n\n"
    "Return ONLY a valid JSON object without markdown fences, explanation, or extra keys.\n"
    "Required JSON format:\n"
    "{\n"
    '  "merchant": "Store Name",\n'
    '  "date": "YYYY-MM-DD",\n'
    '  "total_spend": 12.34,\n'
    '  "categories": {"Groceries": 12.34},\n'
    '  "line_items": [{"description": "Item Name", "category": "Groceries", "amount": 12.34}],\n'
    '  "notes": "Short summary"\n'
    "}"
)


def _resolve_receipt_date(
    detected_date: str | None,
    month_override: str | None,
) -> tuple[date, bool]:
    """
    Resolves the receipt transaction date:
    1. Automatically uses date detected on receipt (formatted YYYY-MM-DD).
    2. Falls back to user-specified date/month override if receipt had no date.
    3. Falls back to current UTC date if neither is present.

    Returns:
        (resolved_date, was_detected_from_receipt)
    """
    if detected_date:
        clean_date = str(detected_date).strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(clean_date, fmt).date(), True
            except ValueError:
                continue
        if len(clean_date) >= 10:
            try:
                return datetime.strptime(clean_date[:10], "%Y-%m-%d").date(), True
            except Exception:
                pass

    if month_override:
        clean_month = str(month_override).strip()
        if len(clean_month) == 7:  # YYYY-MM
            try:
                return datetime.strptime(f"{clean_month}-01", "%Y-%m-%d").date(), False
            except Exception:
                pass
        elif len(clean_month) >= 10:  # YYYY-MM-DD
            try:
                return datetime.strptime(clean_month[:10], "%Y-%m-%d").date(), False
            except Exception:
                pass

    return datetime.utcnow().date(), False


def _save_receipt_line_items(
    line_items: list[dict[str, Any]],
    receipt_date: date,
    merchant: str = "Receipt Merchant",
) -> int:
    if not line_items:
        return 0

    month_key = receipt_date.strftime("%Y-%m")
    date_str = receipt_date.isoformat()
    rows = []
    for item in line_items:
        description = (
            str(item.get("description") or "Receipt item").strip() or "Receipt item"
        )
        category = str(item.get("category") or "Other").strip() or "Other"
        amount = float(item.get("amount") or 0.0)
        rows.append(
            {
                "date": date_str,
                "amount": amount,
                "category": category,
                "merchant": merchant if merchant and merchant != "Unknown Merchant" else description,
                "notes": f"Receipt item: {description}",
                "source": "receipt_ai",
                "month": month_key,
            }
        )

    if not rows:
        return 0

    result = get_supabase_client().table("spend_entries").insert(rows).execute()
    return len(result.data or [])


def get_supabase_table(name: str):
    return get_supabase_client().table(name)


def ensure_seed_user() -> None:
    client = get_supabase_client()
    rows = (
        client.table("budget_users")
        .select("*")
        .eq("username", "admin")
        .limit(1)
        .execute()
    )
    if rows.data:
        return
    client.table("budget_users").insert(
        {
            "username": "admin",
            "password_hash": get_password_hash("Tutu1234"),
            "is_admin": True,
        }
    ).execute()


def get_gemini_key() -> str:
    return settings.gemini_api_key


def ensure_gemini_configured() -> str:
    api_key = get_gemini_key()
    if not api_key:
        raise ValueError(
            "Gemini API key is missing. Add GEMINI_API_KEY to the repository root .env file."
        )
    return api_key


def build_month_key(value: date | str | None) -> str:
    if value is None:
        return datetime.utcnow().strftime("%Y-%m")
    if isinstance(value, str):
        return value[:7]
    return value.strftime("%Y-%m")


def analyze_receipt_image(
    image_data: bytes,
    mime_type: str,
    month: str | None = None,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    api_key = ensure_gemini_configured()
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-3.5-flash-lite")

    user_prompt = (system_prompt or "").strip()
    prompt = user_prompt if user_prompt else DEFAULT_RECEIPT_SYSTEM_PROMPT

    image_part = {
        "inline_data": {
            "mime_type": mime_type,
            "data": image_data,
        }
    }

    response = model.generate_content([prompt, image_part])
    text = response.text
    payload = _extract_json_object(text)

    # 1. Flexible date extraction supporting multiple key variants
    detected_date_raw = (
        payload.get("date")
        or payload.get("transaction_date")
        or payload.get("receipt_date")
        or payload.get("purchase_date")
        or payload.get("invoice_date")
    )
    merchant = str(
        payload.get("merchant")
        or payload.get("store")
        or payload.get("vendor")
        or payload.get("store_name")
        or "Receipt Merchant"
    ).strip()

    resolved_date, was_detected = _resolve_receipt_date(detected_date_raw, month)

    # 2. Flexible line items extraction
    raw_line_items = (
        payload.get("line_items")
        or payload.get("items")
        or payload.get("purchases")
        or []
    )
    if not isinstance(raw_line_items, list):
        raw_line_items = []

    normalized_line_items = []
    for item in raw_line_items:
        if not isinstance(item, dict):
            continue
        desc = str(
            item.get("description")
            or item.get("item")
            or item.get("name")
            or item.get("title")
            or "Receipt item"
        ).strip()

        cat = str(
            item.get("category")
            or payload.get("category")
            or "Other"
        ).strip()

        raw_amt = (
            item.get("amount")
            if item.get("amount") is not None
            else (
                item.get("total_price")
                if item.get("total_price") is not None
                else (
                    item.get("price")
                    if item.get("price") is not None
                    else item.get("unit_price", 0.0)
                )
            )
        )
        try:
            amt = float(raw_amt)
        except (ValueError, TypeError):
            amt = 0.0

        normalized_line_items.append(
            {
                "description": desc,
                "category": cat,
                "amount": amt,
            }
        )

    # 3. Flexible total spend extraction
    raw_total = (
        payload.get("total_spend")
        or payload.get("grand_total")
        or payload.get("total")
        or payload.get("total_amount")
        or payload.get("amount")
    )
    if raw_total is not None:
        try:
            total = float(raw_total)
        except (ValueError, TypeError):
            total = sum(float(item["amount"]) for item in normalized_line_items)
    else:
        total = sum(float(item["amount"]) for item in normalized_line_items)

    # 4. Flexible category map extraction
    raw_categories = payload.get("categories")
    categories = {}
    if isinstance(raw_categories, dict) and raw_categories:
        for k, v in raw_categories.items():
            try:
                categories[str(k)] = float(v)
            except (ValueError, TypeError):
                pass
    if not categories and normalized_line_items:
        for item in normalized_line_items:
            cat = item["category"]
            categories[cat] = round(
                categories.get(cat, 0.0) + float(item["amount"]), 2
            )

    notes = str(payload.get("notes") or "").strip()
    if not notes:
        notes = f"{merchant} receipt with {len(normalized_line_items)} extracted item(s)."

    imported_rows = _save_receipt_line_items(
        line_items=normalized_line_items,
        receipt_date=resolved_date,
        merchant=merchant,
    )

    return {
        "merchant": merchant,
        "date": resolved_date.isoformat(),
        "date_detected": was_detected,
        "line_items": normalized_line_items,
        "categories": categories,
        "monthly_total": total,
        "notes": notes,
        "raw_text": text,
        "imported_rows": imported_rows,
    }


def sum_spend_by_category(month: str | None = None) -> dict[str, float]:
    client = get_supabase_client()
    query = client.table("spend_entries").select("category, amount")
    if month:
        query = query.eq("month", month)
    rows = query.execute().data or []
    totals: dict[str, float] = {}
    for row in rows:
        cat = row.get("category") or "Uncategorized"
        totals[cat] = round(totals.get(cat, 0.0) + float(row.get("amount") or 0.0), 2)
    return totals


def get_dashboard_summary() -> dict[str, Any]:
    client = get_supabase_client()
    spend_rows = client.table("spend_entries").select("amount").execute().data or []
    total_spend = sum(float(row.get("amount") or 0.0) for row in spend_rows)
    by_category = sum_spend_by_category()
    monthly_totals: dict[str, float] = {}
    for row in client.table("spend_entries").select("month, amount").execute().data or []:
        m = row.get("month") or "unknown"
        monthly_totals[m] = round(monthly_totals.get(m, 0.0) + float(row.get("amount") or 0.0), 2)
    recurring_rows = client.table("recurring_expenses").select("amount").execute().data or []
    recurring_total = sum(float(row.get("amount") or 0.0) for row in recurring_rows)
    return {
        "total_spend": round(float(total_spend), 2),
        "by_category": by_category,
        "by_month": monthly_totals,
        "recurring_total": round(float(recurring_total), 2),
    }


def _sanitize_supabase_payload(payload: dict[str, Any]) -> dict[str, Any]:
    sanitized = {
        key: value
        for key, value in payload.items()
        if key != "id" and value is not None
    }
    return _serialize_dates_for_supabase(sanitized)


def _serialize_dates_for_supabase(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    for key in ("date", "next_due_date"):
        value = normalized.get(key)
        if value is not None and hasattr(value, "isoformat"):
            normalized[key] = value.isoformat()
    return normalized


def save_recurring_expense(
    payload: dict[str, Any], entry_id: int | None = None
) -> RecurringExpense:
    client = get_supabase_client()
    payload = _sanitize_supabase_payload(payload)
    if entry_id:
        result = (
            client.table("recurring_expenses")
            .update(payload)
            .eq("id", entry_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Recurring expense not found")
        return RecurringExpense(**result.data[0])

    result = client.table("recurring_expenses").insert(payload).execute()
    return RecurringExpense(**result.data[0])


def delete_recurring_expense(entry_id: int) -> None:
    result = (
        get_supabase_client()
        .table("recurring_expenses")
        .delete()
        .eq("id", entry_id)
        .execute()
    )
    if not result.data:
        raise ValueError("Recurring expense not found")


def add_manual_spend(payload: dict[str, Any]) -> SpendEntry:
    row = {
        key: value
        for key, value in payload.items()
        if key != "id" and value is not None
    }
    row = _serialize_dates_for_supabase(row)
    month = build_month_key(row.get("date"))
    row["month"] = month
    row["amount"] = float(row["amount"])
    result = get_supabase_client().table("spend_entries").insert(row).execute()
    return SpendEntry(**result.data[0])


def update_manual_spend(entry_id: int, payload: dict[str, Any]) -> SpendEntry:
    row = {
        key: value
        for key, value in payload.items()
        if key != "id"
        and key in {"date", "amount", "category", "merchant", "notes", "source"}
        and value is not None
    }
    row = _serialize_dates_for_supabase(row)
    if "date" in row:
        row["month"] = build_month_key(row["date"])
    result = (
        get_supabase_client()
        .table("spend_entries")
        .update(row)
        .eq("id", entry_id)
        .execute()
    )
    if not result.data:
        raise ValueError("Spend entry not found")
    return SpendEntry(**result.data[0])
