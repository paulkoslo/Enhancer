from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ValidationClient:
    validation_handler: Callable[[dict[str, Any]], dict[str, Any]]

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.validation_handler(payload)
