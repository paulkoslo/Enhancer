from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from collections.abc import Callable

from app.core.config import get_settings


class ExecutionDispatcher:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.executor = ThreadPoolExecutor(max_workers=4)

    def dispatch(self, fn: Callable[..., None], *args) -> None:
        if self.settings.inline_execution:
            self.executor.submit(fn, *args)
            return
        self.executor.submit(fn, *args)
