from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ArtifactWriter:
    save_handler: Callable[[str, dict[str, Any]], None]

    def save_preview(self, artifact_type: str, payload: dict[str, Any]) -> None:
        self.save_handler(artifact_type, payload)
