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


def _parse_month_date(month_str: str | None) -> date:
    if not month_str:
        return datetime.utcnow().date()
    clean = month_str.strip()
    try:
        if len(clean) == 7:
            return datetime.strptime(f"{clean}-01", "%Y-%m-%d").date()
        if len(clean) >= 10:
            return datetime.strptime(clean[:10], "%Y-%m-%d").date()
    except Exception:
        pass
    return datetime.utcnow().date()


def _save_receipt_line_items(month: str, line_items: list[dict[str, Any]]) -> int:
    if not line_items:
        return 0

    row_date = _parse_month_date(month)
    rows = []
    for item in line_items:
        description = (
            str(item.get("description") or "Receipt item").strip() or "Receipt item"
        )
        category = str(item.get("category") or "Other").strip() or "Other"
        amount = float(item.get("amount") or 0.0)
        rows.append(
            {
                "date": row_date.isoformat(),
                "amount": amount,
                "category": category,
                "merchant": description,
                "notes": f"Receipt import: {description}",
                "source": "receipt_ai",
                "month": month[:7] if (month and len(month) >= 7) else build_month_key(row_date),
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
    image_data: bytes, mime_type: str, month: str, system_prompt: str
) -> dict[str, Any]:
    api_key = ensure_gemini_configured()
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-3.5-flash-lite")

    prompt = (
        f"{system_prompt}\n\n"
        "Return ONLY a compact JSON object with no markdown fences, no prose, no comments, and no extra keys.\n"
        "Use exactly these keys only: total_spend, categories, line_items, notes.\n"
        "Do not include category_totals, summary, explanation, or any other section.\n"
        "The categories object must be a map of category names to numeric totals.\n"
        "The line_items array must contain objects with exactly these keys: description, category, amount.\n"
        "Keep each original row item, including discounts, refunds, price overrides, and adjustments.\n"
        "Use negative numbers for discounts and refunds.\n"
        "Return valid JSON that can be parsed by Python json.loads() without any extra text.\n"
        'Example: {"total_spend": 4.5, "categories": {"Alcohol & Bars": 4.5}, "line_items": [{"description": "Bulmers Original Bottle", "category": "Alcohol & Bars", "amount": 4.0}, {"description": "Transaction Discount", "category": "Alcohol & Bars", "amount": -0.5}], "notes": "Receipt summary"}'
    )

    image_part = {
        "inline_data": {
            "mime_type": mime_type,
            "data": image_data,
        }
    }

    response = model.generate_content([prompt, image_part])
    text = response.text
    payload = _extract_json_object(text)

    categories = payload.get("categories", {})
    line_items = payload.get("line_items", [])
    total = float(
        payload.get(
            "total_spend", sum(float(item.get("amount", 0)) for item in line_items)
        )
    )

    imported_rows = _save_receipt_line_items(month, line_items)

    return {
        "line_items": line_items,
        "monthly_total": total,
        "notes": payload.get("notes", ""),
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
