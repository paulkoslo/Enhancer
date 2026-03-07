from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.runs.types import ModelProfile


class OpenRouterSettingsResponse(BaseModel):
    has_api_key: bool
    configured: bool
    api_key_preview: str | None = None
    api_key_updated_at: datetime | None = None
    default_model_profile: str
    default_model_id: str | None = None
    available_profiles: list[ModelProfile]


class UpdateOpenRouterSettingsRequest(BaseModel):
    api_key: str | None = None
    default_model_profile: str = "best-quality"
    default_model_id: str | None = None
