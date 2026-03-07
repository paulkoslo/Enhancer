from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

import boto3

from app.core.config import get_settings


class ArtifactStorage(Protocol):
    def save_bytes(self, key: str, data: bytes, content_type: str) -> str: ...
    def save_json(self, key: str, payload: dict) -> str: ...
    def read_bytes(self, key: str) -> bytes: ...
    def resolve_path(self, key: str) -> str | None: ...


class LocalArtifactStorage:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def save_bytes(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.write_bytes(data)
        return key

    def save_json(self, key: str, payload: dict) -> str:
        path = self._path(key)
        path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        return key

    def read_bytes(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def resolve_path(self, key: str) -> str:
        return str(self._path(key))


class S3ArtifactStorage:
    def __init__(self, bucket: str, region: str | None):
        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region)

    def save_bytes(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return key

    def save_json(self, key: str, payload: dict) -> str:
        return self.save_bytes(key, json.dumps(payload, default=str).encode("utf-8"), "application/json")

    def read_bytes(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def resolve_path(self, key: str) -> None:
        return None


def build_artifact_storage() -> ArtifactStorage:
    settings = get_settings()
    if settings.storage_backend == "s3" and settings.s3_bucket:
        return S3ArtifactStorage(bucket=settings.s3_bucket, region=settings.s3_region)
    return LocalArtifactStorage(root=settings.storage_root)
