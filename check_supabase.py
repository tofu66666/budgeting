from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values
from supabase import create_client
from supabase.client import ClientOptions


def load_env_file() -> dict[str, str]:
    env_path = Path(__file__).resolve().parent / ".env"
    values = dotenv_values(env_path)
    merged = {key: str(value) for key, value in values.items() if value is not None}
    return merged


def main() -> None:
    env = load_env_file()
    url = env.get("SUPABASE_URL") or ""
    key = env.get("SUPABASE_KEY") or ""
    if not url:
        raise SystemExit("SUPABASE_URL is missing in .env")
    if not key:
        raise SystemExit("SUPABASE_KEY is missing in .env")
    print(len(key), repr(key[:10]), repr(key[-4:]))
    print(f"URL: {url}")
    print(f"Key present: {bool(key)}")

    options = ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )

    client = create_client(url, key, options)
    print("Supabase client created successfully")

    try:
        result = client.table("app_settings").select("*").limit(1).execute()
        print("Query succeeded")
        print(result)
    except Exception as exc:
        print(f"Query failed: {type(exc).__name__}: {exc}")
        raise


if __name__ == "__main__":
    main()
