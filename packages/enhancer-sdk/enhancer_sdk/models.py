from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ModelClient:
    generate_handler: Callable[[dict[str, Any]], dict[str, Any]]

    def generate_structured(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.generate_handler(payload)
