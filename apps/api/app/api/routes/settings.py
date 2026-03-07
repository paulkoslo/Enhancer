from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.domain.provider.capabilities import list_profiles
from app.domain.settings.service import SettingsService
from app.schemas.settings import OpenRouterSettingsResponse, UpdateOpenRouterSettingsRequest


router = APIRouter()
service = SettingsService()


def _serialize_openrouter_settings(session: Session) -> OpenRouterSettingsResponse:
    settings = service.get_workspace_settings(session)
    preview, record = service.get_openrouter_key_preview(session)
    configured = record is not None
    return OpenRouterSettingsResponse(
        has_api_key=configured,
        configured=configured,
        api_key_preview=preview,
        api_key_updated_at=record.updated_at if record else None,
        default_model_profile=settings.default_model_profile,
        default_model_id=settings.default_model_id,
        available_profiles=list_profiles(),
    )


@router.get("/openrouter", response_model=OpenRouterSettingsResponse)
def get_openrouter_settings(session: Session = Depends(get_session)) -> OpenRouterSettingsResponse:
    return _serialize_openrouter_settings(session)


@router.post("/openrouter", response_model=OpenRouterSettingsResponse)
def update_openrouter_settings(
    payload: UpdateOpenRouterSettingsRequest,
    session: Session = Depends(get_session),
) -> OpenRouterSettingsResponse:
    if payload.api_key:
        service.upsert_openrouter_key(session, api_key=payload.api_key)
    service.set_workspace_model_defaults(
        session,
        default_model_profile=payload.default_model_profile,
        default_model_id=payload.default_model_id,
    )
    session.commit()
    return _serialize_openrouter_settings(session)


@router.delete("/openrouter", response_model=OpenRouterSettingsResponse)
def delete_openrouter_key(session: Session = Depends(get_session)) -> OpenRouterSettingsResponse:
    service.delete_openrouter_key(session)
    session.commit()
    return _serialize_openrouter_settings(session)
