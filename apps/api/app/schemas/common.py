from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ApiMessage(BaseModel):
    message: str


class TimestampedResponse(BaseModel):
    created_at: datetime
    updated_at: datetime | None = None


class PaginatedList(BaseModel):
    items: list[Any]
