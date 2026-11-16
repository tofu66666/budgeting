from __future__ import annotations

from base64 import b64decode
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.database import get_supabase_client
from app.models import BudgetUser

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD_HASH = "$2b$12$5.Qdde9Mw30oWrYGU9Uxr.bcgA55MNyt0z5of.oJ.5S34T4/NyEay"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(username: str) -> str:
    expires_delta = timedelta(hours=8)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, settings.app_secret, algorithm=ALGORITHM)


def authenticate_user(username: str, password: str) -> Optional[BudgetUser]:
    if username == ADMIN_USERNAME and verify_password(password, ADMIN_PASSWORD_HASH):
        return BudgetUser(
            id=1,
            username=ADMIN_USERNAME,
            password_hash=ADMIN_PASSWORD_HASH,
            is_admin=True,
        )
    return None


def _authenticate_basic_auth(raw_header: str) -> Optional[BudgetUser]:
    if not raw_header.startswith("Basic "):
        return None
    encoded = raw_header.replace("Basic ", "", 1)
    try:
        decoded = b64decode(encoded.encode("utf-8")).decode("utf-8")
    except Exception:
        return None
    username, _, password = decoded.partition(":")
    return authenticate_user(username, password)


def _authenticate_bearer_token(raw_header: str) -> Optional[BudgetUser]:
    if not raw_header.startswith("Bearer "):
        return None
    token = raw_header.replace("Bearer ", "", 1)
    try:
        payload = jwt.decode(token, settings.app_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
    username = payload.get("sub")
    if username == ADMIN_USERNAME:
        return BudgetUser(
            id=1,
            username=ADMIN_USERNAME,
            password_hash=ADMIN_PASSWORD_HASH,
            is_admin=True,
        )
    return None


def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> BudgetUser:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication header",
            headers={"WWW-Authenticate": 'Basic realm="Budget"'},
        )

    user = _authenticate_bearer_token(authorization)
    if user is None:
        user = _authenticate_basic_auth(authorization)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": 'Basic realm="Budget"'},
        )
    return user
