from typing import Optional

from supabase import Client, create_client
from supabase.client import ClientOptions

from app.config import get_settings

settings = get_settings()
_client: Optional[Client] = None


def get_supabase_client() -> Client:
    global _client
    if _client is not None:
        return _client

    url = (settings.supabase_url or "").strip().rstrip("/")
    key = (settings.supabase_key or "").strip()

    if not url:
        raise RuntimeError("SUPABASE_URL is empty")
    if not key:
        raise RuntimeError("SUPABASE_KEY is empty")

    options = ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )
    _client = create_client(url, key, options)
    return _client
