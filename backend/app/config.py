"""Settings read from environment variables.

Add every new variable here and to .env.example, with a placeholder value.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


def _load_runtime_env() -> None:
    env_paths = [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env",
        Path.cwd() / ".env",
    ]
    for env_path in env_paths:
        if env_path.exists():
            load_dotenv(env_path, override=False)


_load_runtime_env()


@dataclass(frozen=True)
class Settings:
    app_name: str = "Budget AI Dashboard"
    app_secret: str = os.getenv("APP_SECRET", "change-me")
    app_env: str = os.getenv("APP_ENV", "dev")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    vite_api_base_url: str = os.getenv("VITE_API_BASE_URL", "http://localhost:8000")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


@lru_cache
def get_settings() -> Settings:
    return Settings()
