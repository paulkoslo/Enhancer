from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ResearchClient:
    search_handler: Callable[[dict[str, Any]], dict[str, Any]]

    def search_web(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.search_handler(payload)
