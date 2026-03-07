from __future__ import annotations

def test_settings_service_masks_and_deletes_openrouter_key():
    from app.db.init_db import init_db
    from app.db.session import SessionLocal
    from app.domain.settings.service import SettingsService

    init_db()
    service = SettingsService()

    with SessionLocal() as session:
        service.upsert_openrouter_key(session, api_key="sk-or-v1-super-secret-key-1234")
        preview, record = service.get_openrouter_key_preview(session)

        assert preview == "sk-or-v1-s...1234"
        assert record is not None

        service.delete_openrouter_key(session)
        preview, record = service.get_openrouter_key_preview(session)

        assert preview is None
        assert record is None
