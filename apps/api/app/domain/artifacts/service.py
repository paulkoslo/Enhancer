from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import Artifact
from app.domain.artifacts.storage import build_artifact_storage
from app.domain.runs.types import ArtifactKind


class ArtifactService:
    def __init__(self) -> None:
        self.storage = build_artifact_storage()

    def save_bytes(
        self,
        session: Session,
        *,
        kind: ArtifactKind,
        data: bytes,
        content_type: str,
        run_id: str | None = None,
        file_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        suffix: str = "",
    ) -> Artifact:
        key = f"{kind.value}/{uuid4()}{suffix}"
        self.storage.save_bytes(key=key, data=data, content_type=content_type)
        artifact = Artifact(
            run_id=run_id,
            file_id=file_id,
            kind=kind.value,
            storage_key=key,
            content_type=content_type,
            metadata_json=metadata or {},
        )
        session.add(artifact)
        session.flush()
        return artifact

    def save_json(
        self,
        session: Session,
        *,
        kind: ArtifactKind,
        payload: dict[str, Any],
        run_id: str | None = None,
        file_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Artifact:
        key = f"{kind.value}/{uuid4()}.json"
        self.storage.save_json(key=key, payload=payload)
        artifact = Artifact(
            run_id=run_id,
            file_id=file_id,
            kind=kind.value,
            storage_key=key,
            content_type="application/json",
            metadata_json=metadata or {},
        )
        session.add(artifact)
        session.flush()
        return artifact

    def read_bytes(self, artifact: Artifact) -> bytes:
        return self.storage.read_bytes(artifact.storage_key)

    def resolve_path(self, artifact: Artifact) -> str | None:
        return self.storage.resolve_path(artifact.storage_key)

    def write_path(self, kind: ArtifactKind, *, suffix: str = "") -> Path | None:
        dummy_key = f"{kind.value}/{uuid4()}{suffix}"
        resolved = self.storage.resolve_path(dummy_key)
        return Path(resolved) if resolved else None
