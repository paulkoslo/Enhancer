from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from time import sleep
from time import perf_counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import RunEvent
from app.domain.runs.types import RunEventPayload, RunEventType


class EventService:
    def emit(
        self,
        session: Session,
        *,
        run_id: str,
        event_type: RunEventType,
        message: str,
        payload: dict[str, Any] | None = None,
    ) -> RunEvent:
        event = RunEvent(
            run_id=run_id,
            event_type=event_type.value,
            message=message,
            payload_json=payload or {},
        )
        session.add(event)
        session.flush()
        return event

    def list_for_run(self, session: Session, run_id: str) -> list[RunEvent]:
        stmt = select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.created_at.asc())
        return list(session.scalars(stmt))

    @contextmanager
    def agent_step(
        self,
        session: Session,
        *,
        run_id: str,
        agent: str,
        action: str,
        row_index: int | None = None,
        payload: dict[str, Any] | None = None,
    ):
        payload = {
            "agent": agent,
            "action": action,
            "phase": "start",
            "run_id": run_id,
            **(payload or {}),
        }
        if row_index is not None:
            payload["row_index"] = row_index
        self.emit(
            session,
            run_id=run_id,
            event_type=RunEventType.AGENT,
            message=f"{agent} started {action}.",
            payload=payload,
        )
        started_at = perf_counter()
        try:
            yield
        except Exception as exc:  # noqa: BLE001
            error_payload = dict(payload)
            error_payload.update(
                {
                    "phase": "error",
                    "duration_ms": int((perf_counter() - started_at) * 1000),
                    "error_code": exc.__class__.__name__,
                }
            )
            self.emit(
                session,
                run_id=run_id,
                event_type=RunEventType.AGENT,
                message=f"{agent} failed {action}: {exc}",
                payload=error_payload,
            )
            raise
        finish_payload = dict(payload)
        finish_payload.update(
            {
                "phase": "finish",
                "duration_ms": int((perf_counter() - started_at) * 1000),
            }
        )
        self.emit(
            session,
            run_id=run_id,
            event_type=RunEventType.AGENT,
            message=f"{agent} finished {action}.",
            payload=finish_payload,
        )

    def stream(self, session_factory, run_id: str) -> Iterator[str]:
        last_seen_at = None
        last_seen_id: str | None = None
        while True:
            with session_factory() as session:
                stmt = select(RunEvent).where(RunEvent.run_id == run_id)
                if last_seen_at is not None:
                    stmt = stmt.where(RunEvent.created_at >= last_seen_at)
                stmt = stmt.order_by(RunEvent.created_at.asc())
                events = list(session.scalars(stmt))
                for event in events:
                    if last_seen_at is not None and event.created_at < last_seen_at:
                        continue
                    if event.id == last_seen_id:
                        continue
                    payload = RunEventPayload(
                        type=RunEventType(event.event_type),
                        message=event.message,
                        payload=event.payload_json,
                        created_at=event.created_at,
                    )
                    yield f"data: {payload.model_dump_json()}\n\n"
                    last_seen_id = event.id
                    last_seen_at = event.created_at
            sleep(1)
