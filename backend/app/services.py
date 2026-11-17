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


DEFAULT_RECEIPT_SYSTEM_PROMPT = """You are an expert AI financial accountant and receipt OCR specialist.
Your task is to analyze the provided receipt or invoice image and extract structured financial data with 100% precision.

### EXTRACTION GUIDELINES:
1. MERCHANT:
   - Identify the business, store, or vendor name (e.g., "Trader Joe's", "Shell", "Costco", "Cider Cellar", "Target", "Uber").
   - If unreadable, use "Unknown Merchant".

2. TRANSACTION DATE:
   - Locate the purchase/transaction date printed on the receipt (check header, footer, tax lines, or transaction timestamp).
   - Convert strictly to ISO format 'YYYY-MM-DD' (e.g. '2024-11-16' or '2018-09-24').
   - If the year is 2 digits, infer the 4-digit century (e.g. '18' -> '2018').
   - If NO date is visible or legible anywhere on the receipt, output null.

3. LINE ITEMS (CRITICAL: Extract EVERY single item, product, fee, and adjustment):
   - "item": Exact description/name of the product or service (e.g. "Bulmers Original Bottle", "Organic Milk 1L").
   - "quantity": Number of units purchased as float/int (default 1.0).
   - "unit_price": Price per single unit as float.
   - "total_price": Final line item charge as float (e.g. 4.00).
   - "category": Select the single most accurate budget category from:
     * "Groceries"
     * "Dining Out"
     * "Alcohol & Drinks"
     * "Housing"
     * "Utilities"
     * "Transportation"
     * "Shopping"
     * "Entertainment"
     * "Healthcare"
     * "Personal Care"
     * "Furniture"
     * "Luxury"
     * "Education"
     * "Travel"
     * "Subscriptions"
     * "Insurance"
     * "Gifts & Donations"
     * "Discounts & Adjustments"
     * "Other"

4. DISCOUNTS, SURCHARGES & OVERRIDES:
   - Promo codes, manager overrides, bottle deposits, returns, and discounts MUST be recorded as separate line items with category "Discounts & Adjustments" and negative total_price (e.g. -2.00).

5. GRAND TOTAL:
   - The final total charged or paid on the receipt as a numeric float (e.g. 4.50).

6. CATEGORIES BREAKDOWN:
   - A key-value dictionary mapping each category to its sum: {"Alcohol & Drinks": 8.00, "Discounts & Adjustments": -3.00}.

7. SUMMARY NOTES:
   - A concise 1-sentence transaction summary.

### OUTPUT REQUIREMENT:
You must output ONLY raw, valid JSON conforming exactly to this structure:
{
  "merchant": "Store Name",
  "date": "YYYY-MM-DD or null",
  "grand_total": 0.00,
  "categories": {
    "Category Name": 0.00
  },
  "line_items": [
    {
      "item": "Product Description",
      "quantity": 1.0,
      "unit_price": 0.00,
      "total_price": 0.00,
      "category": "Category Name"
    }
  ],
  "notes": "Transaction summary"
}
"""


def build_receipt_prompt(user_prompt: str | None = None) -> str:
    base = DEFAULT_RECEIPT_SYSTEM_PROMPT.strip()
    if user_prompt and user_prompt.strip() and user_prompt.strip() != base:
        return (
            f"{base}\n\n"
            f"### ADDITIONAL USER INSTRUCTIONS:\n{user_prompt.strip()}\n\n"
            "REMINDER: Regardless of additional instructions, you MUST return ONLY a JSON object matching the required schema above."
        )
    return base


_runtime_gemini_key: str | None = None


def save_gemini_key(key: str) -> None:
    global _runtime_gemini_key
    clean_key = (key or "").strip()
    _runtime_gemini_key = clean_key
    import os
    os.environ["GEMINI_API_KEY"] = clean_key
    try:
        client = get_supabase_client()
        client.table("app_settings").upsert(
            {"key": "gemini_api_key", "value": clean_key}, on_conflict="key"
        ).execute()
    except Exception:
        pass


def get_gemini_key(override_key: str | None = None) -> str:
    if override_key and override_key.strip():
        return override_key.strip()
    if _runtime_gemini_key and _runtime_gemini_key.strip():
        return _runtime_gemini_key.strip()
    import os
    env_key = os.getenv("GEMINI_API_KEY") or settings.gemini_api_key
    if env_key and env_key.strip():
        return env_key.strip()
    try:
        client = get_supabase_client()
        res = client.table("app_settings").select("value").eq("key", "gemini_api_key").limit(1).execute()
        if res.data and res.data[0].get("value"):
            return res.data[0]["value"]
    except Exception:
        pass
    return ""


def ensure_gemini_configured(override_key: str | None = None) -> str:
    api_key = get_gemini_key(override_key)
    if not api_key:
        raise ValueError(
            "Gemini API key is missing. Please add your API key in Settings (or pass it in the request, or configure GEMINI_API_KEY in environment variables)."
        )
    return api_key


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
            str(
                item.get("item")
                or item.get("description")
                or item.get("name")
                or item.get("title")
                or "Receipt item"
            ).strip()
            or "Receipt item"
        )
        category = str(item.get("category") or "Other").strip() or "Other"
        raw_amt = (
            item.get("total_price")
            if item.get("total_price") is not None
            else (
                item.get("amount")
                if item.get("amount") is not None
                else item.get("price", 0.0)
            )
        )
        try:
            amount = float(raw_amt)
        except (ValueError, TypeError):
            amount = 0.0

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
    override_api_key: str | None = None,
) -> dict[str, Any]:
    api_key = ensure_gemini_configured(override_api_key)
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        "gemini-3.5-flash-lite",
        generation_config={"response_mime_type": "application/json"},
    )

    prompt = build_receipt_prompt(system_prompt)

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
            item.get("item")
            or item.get("description")
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
            item.get("total_price")
            if item.get("total_price") is not None
            else (
                item.get("amount")
                if item.get("amount") is not None
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
                "item": desc,
                "description": desc,
                "category": cat,
                "amount": amt,
                "total_price": amt,
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("unit_price", amt),
            }
        )

    # 3. Flexible total spend extraction
    raw_total = (
        payload.get("grand_total")
        or payload.get("total_spend")
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
