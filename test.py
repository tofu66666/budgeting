import os
from supabase import create_client
from supabase.client import ClientOptions

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

print("SUPABASE_URL:", url)
print("SUPABASE_KEY present:", bool(key))

if not url or not key:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY environment variables")

options = ClientOptions(
    auto_refresh_token=False,
    persist_session=False,
)

client = create_client(url, key, options)
print("Supabase client created successfully")

try:
    resp = client.table("app_settings").select("*").limit(1).execute()
    print("Query succeeded")
    print(resp)
except Exception as exc:
    print("Query failed:", type(exc).__name__, exc)
    raise
