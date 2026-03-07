from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class FileSheetResponse(BaseModel):
    id: str
    sheet_name: str
    row_count: int
    column_count: int
    columns: list[str]
    preview: list[dict[str, Any]]
    profile: dict[str, Any]


class FileResponse(BaseModel):
    id: str
    original_name: str
    media_type: str
    size_bytes: int
    created_at: datetime
    sheets: list[FileSheetResponse]
