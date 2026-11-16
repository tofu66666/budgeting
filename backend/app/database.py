from supabase import Client, create_client
from supabase.client import ClientOptions

from app.config import get_settings

settings = get_settings()


def get_supabase_client() -> Client:
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
    return create_client(url, key, options)
