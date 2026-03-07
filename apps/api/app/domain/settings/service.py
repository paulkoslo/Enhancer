from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_value, encrypt_value
from app.db.models import ApiKey, WorkspaceSettings


class SettingsService:
    def get_workspace_settings(self, session: Session) -> WorkspaceSettings:
        settings = session.get(WorkspaceSettings, "workspace")
        if settings:
            return settings
        settings = WorkspaceSettings(id="workspace")
        session.add(settings)
        session.flush()
        return settings

    def set_workspace_model_defaults(
        self, session: Session, *, default_model_profile: str, default_model_id: str | None
    ) -> WorkspaceSettings:
        settings = self.get_workspace_settings(session)
        settings.default_model_profile = default_model_profile
        settings.default_model_id = default_model_id
        session.flush()
        return settings

    def upsert_openrouter_key(self, session: Session, *, api_key: str, name: str = "workspace") -> ApiKey:
        record = self.get_openrouter_key_record(session)
        if record is None:
            record = ApiKey(provider="openrouter", scope="workspace", name=name, encrypted_value="")
            session.add(record)
        record.name = name
        record.encrypted_value = encrypt_value(api_key)
        session.flush()
        return record

    def get_openrouter_key_record(self, session: Session) -> ApiKey | None:
        stmt = select(ApiKey).where(ApiKey.provider == "openrouter", ApiKey.scope == "workspace")
        return session.scalars(stmt).first()

    def get_openrouter_key(self, session: Session) -> str | None:
        record = self.get_openrouter_key_record(session)
        if record is None:
            return None
        return decrypt_value(record.encrypted_value)

    def delete_openrouter_key(self, session: Session) -> None:
        record = self.get_openrouter_key_record(session)
        if record is None:
            return
        session.delete(record)
        session.flush()

    def get_openrouter_key_preview(self, session: Session) -> tuple[str | None, ApiKey | None]:
        record = self.get_openrouter_key_record(session)
        if record is None:
            return None, None
        return self.mask_secret(decrypt_value(record.encrypted_value)), record

    @staticmethod
    def mask_secret(value: str) -> str:
        secret = value.strip()
        if not secret:
            return ""
        if len(secret) <= 8:
            return f"{secret[:2]}...{secret[-2:]}"
        return f"{secret[:10]}...{secret[-4:]}"
