from __future__ import annotations

import dramatiq

from app.domain.execution.service import ExecutionService


service = ExecutionService()


@dramatiq.actor
def run_dry_run(run_id: str) -> None:
    service._run_dry_run(run_id)  # noqa: SLF001


@dramatiq.actor
def run_full_run(run_id: str) -> None:
    service._run_full(run_id)  # noqa: SLF001
