from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, FastAPI, HTTPException, File, Form, Header, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_supabase_client
from app.models import BudgetUser
from app.schemas import (
    AppSettingsPayload,
    DashboardSummary,
    LoginRequest,
    RecurringExpenseInput,
    RecurringExpenseResponse,
    SpendEntryInput,
    SpendEntryResponse,
    TokenResponse,
)
from app.services import (
    add_manual_spend,
    analyze_receipt_image,
    delete_recurring_expense,
    ensure_seed_user,
    get_dashboard_summary,
    get_gemini_key,
    save_gemini_key,
    save_recurring_expense,
    update_manual_spend,
)

logger = logging.getLogger("uvicorn.error")
settings = get_settings()

api_router = APIRouter(prefix="/api")

app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    msg = str(exc)
    status_code = 404 if "not found" in msg.lower() else 400
    return JSONResponse(status_code=status_code, content={"detail": msg})


@app.on_event("startup")
def startup_event():
    try:
        ensure_seed_user()
    except Exception as exc:
        logger.warning(f"Could not seed admin user on startup: {exc}")


@api_router.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@api_router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    from app.auth import authenticate_user, create_access_token

    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user.username)
    return TokenResponse(access_token=token)


@api_router.get("/settings")
def get_settings_status(user: BudgetUser = Depends(get_current_user)) -> dict:
    key = get_gemini_key()
    has_key = bool(key and len(key) > 5)
    masked = f"{key[:4]}...{key[-4:]}" if has_key and len(key) >= 8 else ("Configured" if has_key else "")
    return {
        "has_gemini_api_key": has_key,
        "gemini_api_key_masked": masked,
    }


@api_router.post("/settings")
def update_settings(
    payload: AppSettingsPayload,
    user: BudgetUser = Depends(get_current_user),
) -> dict:
    if payload.gemini_api_key:
        save_gemini_key(payload.gemini_api_key.strip())
    key = get_gemini_key()
    has_key = bool(key and len(key) > 5)
    masked = f"{key[:4]}...{key[-4:]}" if has_key and len(key) >= 8 else ("Configured" if has_key else "")
    return {
        "status": "success",
        "has_gemini_api_key": has_key,
        "gemini_api_key_masked": masked,
    }


@api_router.post("/receipt/analyze")
async def analyze_receipt(
    file: UploadFile = File(...),
    month: str | None = Form(default=None),
    system_prompt: str | None = Form(default=None),
    api_key: str | None = Form(default=None),
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-API-Key"),
    user: BudgetUser = Depends(get_current_user),
) -> dict:
    image_data = await file.read()
    override_key = (api_key or x_gemini_api_key or "").strip() or None
    payload = analyze_receipt_image(
        image_data=image_data,
        mime_type=file.content_type or "image/jpeg",
        month=month,
        system_prompt=system_prompt,
        override_api_key=override_key,
    )
    return payload


@api_router.get("/dashboard", response_model=DashboardSummary)
def dashboard(user: BudgetUser = Depends(get_current_user)) -> DashboardSummary:
    return DashboardSummary(**get_dashboard_summary())


@api_router.get("/spend", response_model=list[SpendEntryResponse])
def list_spend(
    user: BudgetUser = Depends(get_current_user),
) -> list[SpendEntryResponse]:
    rows = (
        get_supabase_client()
        .table("spend_entries")
        .select("*")
        .order("date", desc=True)
        .execute()
        .data
    )
    return [SpendEntryResponse(**row) for row in rows]


@api_router.post("/spend", response_model=SpendEntryResponse)
def create_spend(
    payload: SpendEntryInput, user: BudgetUser = Depends(get_current_user)
) -> SpendEntryResponse:
    entry = add_manual_spend(payload.model_dump())
    return SpendEntryResponse(**entry.__dict__)


@api_router.put("/spend/{entry_id}", response_model=SpendEntryResponse)
def update_spend(
    entry_id: int,
    payload: SpendEntryInput,
    user: BudgetUser = Depends(get_current_user),
) -> SpendEntryResponse:
    entry = update_manual_spend(entry_id, payload.model_dump())
    return SpendEntryResponse(**entry.__dict__)


@api_router.delete("/spend/{entry_id}")
def delete_spend(entry_id: int, user: BudgetUser = Depends(get_current_user)) -> dict:
    result = (
        get_supabase_client()
        .table("spend_entries")
        .delete()
        .eq("id", entry_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Spend entry not found")
    return {"status": "deleted"}


@api_router.get("/recurring", response_model=list[RecurringExpenseResponse])
def list_recurring(
    user: BudgetUser = Depends(get_current_user),
) -> list[RecurringExpenseResponse]:
    rows = (
        get_supabase_client()
        .table("recurring_expenses")
        .select("*")
        .order("next_due_date", desc=False)
        .execute()
        .data
    )
    return [RecurringExpenseResponse(**row) for row in rows]


@api_router.post("/recurring", response_model=RecurringExpenseResponse)
def create_recurring(
    payload: RecurringExpenseInput, user: BudgetUser = Depends(get_current_user)
) -> RecurringExpenseResponse:
    recurring = save_recurring_expense(payload.model_dump())
    return RecurringExpenseResponse(**recurring.__dict__)


@api_router.put("/recurring/{entry_id}", response_model=RecurringExpenseResponse)
def update_recurring(
    entry_id: int,
    payload: RecurringExpenseInput,
    user: BudgetUser = Depends(get_current_user),
) -> RecurringExpenseResponse:
    recurring = save_recurring_expense(payload.model_dump(), entry_id=entry_id)
    return RecurringExpenseResponse(**recurring.__dict__)


@api_router.delete("/recurring/{entry_id}")
def delete_recurring(
    entry_id: int, user: BudgetUser = Depends(get_current_user)
) -> dict:
    delete_recurring_expense(entry_id)
    return {"status": "deleted"}


app.include_router(api_router)
