from datetime import date
from typing import Optional, Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AppSettingsPayload(BaseModel):
    gemini_api_key: Optional[str] = None


class SpendEntryInput(BaseModel):
    id: Optional[int] = None
    date: date
    amount: float
    category: str
    merchant: Optional[str] = None
    notes: Optional[str] = None
    source: str = "manual"
    month: Optional[str] = None


class SpendEntryResponse(SpendEntryInput):
    id: int


class RecurringExpenseInput(BaseModel):
    id: Optional[int] = None
    name: str
    category: str
    amount: float = Field(gt=0)
    frequency: Literal["monthly", "weekly", "yearly", "quarterly"]
    next_due_date: date
    is_active: bool = True
    notes: Optional[str] = None


class RecurringExpenseResponse(RecurringExpenseInput):
    id: int


class ReceiptAnalysisRequest(BaseModel):
    month: str
    system_prompt: str = (
        "Extract the receipt items and categorize each as a budget expense. Return JSON with total_spend, categories: {category: amount}, and a list of line items with description, category, amount."
    )


class ReceiptAnalysisResponse(BaseModel):
    line_items: list[dict]
    monthly_total: float
    notes: str
    raw_text: str
    imported_rows: int = 0


class DashboardSummary(BaseModel):
    total_spend: float
    by_category: dict[str, float]
    by_month: dict[str, float]
    recurring_total: float
