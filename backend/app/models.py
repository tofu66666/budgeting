from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class AppSettings:
    id: Optional[int] = None
    key: str = ""
    value: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class SpendEntry:
    id: Optional[int] = None
    date: Optional[date] = None
    amount: float = 0.0
    category: str = ""
    merchant: Optional[str] = None
    notes: Optional[str] = None
    source: str = "manual"
    month: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class RecurringExpense:
    id: Optional[int] = None
    name: str = ""
    category: str = ""
    amount: float = 0.0
    frequency: str = "monthly"
    next_due_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ReceiptExtraction:
    id: Optional[int] = None
    month: str = ""
    source: str = "gemini"
    payload: str = ""
    created_at: Optional[datetime] = None


@dataclass
class BudgetUser:
    id: Optional[int] = None
    username: str = ""
    password_hash: str = ""
    is_admin: bool = True
    created_at: Optional[datetime] = None
