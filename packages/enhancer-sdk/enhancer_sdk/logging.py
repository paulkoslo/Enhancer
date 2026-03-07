from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(slots=True)
class RunLogger:
    emit_handler: Callable[[str, str], None]

    def emit(self, level: str, message: str) -> None:
        self.emit_handler(level, message)
