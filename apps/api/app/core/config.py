from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ENHANCER_",
        env_file=".env",
        extra="ignore",
    )

    app_name: str = "Enhancer API"
    api_prefix: str = "/api"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    database_url: str = "sqlite:///./var/enhancer.db"
    redis_url: str = "redis://localhost:6379/0"

    storage_backend: str = "local"
    storage_root: Path = Path("./var/artifacts")
    s3_bucket: str | None = None
    s3_region: str | None = None

    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_api_key: str | None = None
    openrouter_site_url: str = "http://localhost:3000"
    openrouter_app_name: str = "Enhancer"

    encryption_secret: str = "change-me-in-production"
    enable_advanced_sandbox: bool = False
    default_model_profile: str = "best-quality"
    inline_execution: bool = True
    dry_run_sample_size: int = 3
    max_retries_per_row: int = 1
    request_timeout_seconds: float = 90.0


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    return settings
