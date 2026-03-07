from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import ResearchEvidence, RowResult, RunRecord
from app.db.session import SessionLocal
from app.domain.events.service import EventService
from app.domain.execution.export import ExportService
from app.domain.planning.service import PlanningService
from app.domain.provider.openrouter import OpenRouterClient
from app.domain.research.service import ResearchService
from app.domain.runs.types import RowStatus, RowResultPayload, RunEventType, RunPlan, RunStatus
from app.domain.runs.types import ValidationState
from app.domain.settings.service import SettingsService
from app.domain.validation.service import ValidationService
from app.domain.workbooks.service import WorkbookService
from app.workers.dispatcher import ExecutionDispatcher


@dataclass(slots=True)
class RunExecutionContext:
    run: RunRecord
    plan: RunPlan
    api_key: str


class ExecutionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.events = EventService()
        self.settings_service = SettingsService()
        self.workbooks = WorkbookService()
        self.research = ResearchService()
        self.validation = ValidationService()
        self.provider = OpenRouterClient()
        self.export = ExportService()
        self.dispatcher = ExecutionDispatcher()
        self.planning = PlanningService()

    def start_dry_run(self, session: Session, *, run: RunRecord) -> None:
        run.status = RunStatus.DRY_RUN_PREPARING.value
        session.flush()

    def approve_dry_run(self, session: Session, *, run: RunRecord) -> None:
        run.status = RunStatus.AWAITING_FINAL_APPROVAL.value
        self.events.emit(
            session,
            run_id=run.id,
            event_type=RunEventType.STATUS,
            message="Dry run approved; ready for full execution.",
            payload={"status": run.status},
        )
        session.flush()

    def queue_full_run(self, session: Session, *, run: RunRecord) -> None:
        run.status = RunStatus.FULL_RUN_QUEUED.value
        self.events.emit(
            session,
            run_id=run.id,
            event_type=RunEventType.STATUS,
            message="Full run queued.",
            payload={"status": run.status},
        )
        session.flush()

    def dispatch_dry_run(self, run_id: str) -> None:
        self.dispatcher.dispatch(self._run_dry_run, run_id)

    def dispatch_full_run(self, run_id: str) -> None:
        self.dispatcher.dispatch(self._run_full, run_id)

    def perform_action(self, session: Session, *, run: RunRecord, action: str) -> None:
        if action == "pause":
            run.pause_requested = True
            run.status = RunStatus.PAUSED.value
        elif action == "cancel":
            run.cancel_requested = True
            run.status = RunStatus.CANCELLED.value
        elif action == "retry-failed":
            run.pause_requested = False
            run.cancel_requested = False
            self.dispatcher.dispatch(self._retry_failed_rows, run.id)
        else:
            raise ValueError("unsupported action")
        self.events.emit(
            session,
            run_id=run.id,
            event_type=RunEventType.STATUS,
            message=f"Run action applied: {action}.",
            payload={"status": run.status},
        )
        session.flush()

    def _run_dry_run(self, run_id: str) -> None:
        with SessionLocal() as session:
            try:
                context = self._load_context(session, run_id)
                with self.events.agent_step(session, run_id=run_id, agent="Execution", action="dry_run"):
                    context.run.status = RunStatus.DRY_RUN_RUNNING.value
                    self.events.emit(
                        session,
                        run_id=run_id,
                        event_type=RunEventType.STATUS,
                        message="Dry run started.",
                        payload={"status": context.run.status},
                    )
                    session.flush()
                    self._clear_existing_row_results(session, run_id=run_id)
                    dataframe = self.workbooks.load_sheet_dataframe(
                        session, file_id=context.run.file_id, sheet_name=context.plan.sheet_name
                    ).fillna("")
                    rows = dataframe.to_dict(orient="records")
                    for row_index in context.plan.sample_row_indices:
                        payload = self._process_row(
                            session,
                            context=context,
                            row_index=row_index,
                            row_data=rows[row_index],
                            save=True,
                        )
                        self.events.emit(
                            session,
                            run_id=run_id,
                            event_type=RunEventType.DRY_RUN,
                            message=f"Dry-run row {row_index} completed.",
                            payload={"row_index": row_index, "status": payload.status.value},
                        )
                    self._persist_dry_run_artifact(
                        session,
                        run_id=run_id,
                        file_id=context.run.file_id,
                        sheet_name=context.plan.sheet_name,
                    )
                    context.run.status = RunStatus.DRY_RUN_REVIEW.value
                    self.events.emit(
                        session,
                        run_id=run_id,
                        event_type=RunEventType.STATUS,
                        message="Dry run ready for review.",
                        payload={"status": context.run.status},
                    )
                session.commit()
            except Exception as exc:  # noqa: BLE001
                self._mark_run_failed(session, run_id=run_id, message=f"Dry run failed: {exc}", error=exc)
                session.commit()

    def _run_full(self, run_id: str) -> None:
        with SessionLocal() as session:
            try:
                context = self._load_context(session, run_id)
                if context.run.cancel_requested:
                    return
                with self.events.agent_step(session, run_id=run_id, agent="Execution", action="full_run"):
                    context.run.status = RunStatus.FULL_RUN_RUNNING.value
                    self.events.emit(
                        session,
                        run_id=run_id,
                        event_type=RunEventType.STATUS,
                        message="Full run started.",
                        payload={"status": context.run.status},
                    )
                    session.commit()
                    dataframe = self.workbooks.load_sheet_dataframe(
                        session, file_id=context.run.file_id, sheet_name=context.plan.sheet_name
                    ).fillna("")
                    rows = dataframe.to_dict(orient="records")
                    max_workers = min(resolve_concurrency(context.plan.model_profile), 6)
                    if self.settings.database_url.startswith("sqlite"):
                        max_workers = 1
                    with ThreadPoolExecutor(max_workers=max_workers) as executor:
                        futures = {
                            executor.submit(self._process_row_in_new_session, run_id, row_index, row): row_index
                            for row_index, row in enumerate(rows)
                        }
                        for future in as_completed(futures):
                            row_index = futures[future]
                            payload = future.result()
                            self.events.emit(
                                session,
                                run_id=run_id,
                                event_type=RunEventType.ROW_PROGRESS,
                                message=f"Row {row_index} completed.",
                                payload={"row_index": row_index, "status": payload.status.value},
                            )
                            session.commit()
                    context.run.status = RunStatus.EXPORTING.value
                    with self.events.agent_step(session, run_id=run_id, agent="Export", action="final_workbook"):
                        self.events.emit(
                            session,
                            run_id=run_id,
                            event_type=RunEventType.EXPORT,
                            message="Exporting enriched workbook.",
                            payload={"status": context.run.status},
                        )
                        self.export.export_run(
                            session,
                            run_id=run_id,
                            file_id=context.run.file_id,
                            sheet_name=context.plan.sheet_name,
                        )
                    context.run.status = RunStatus.COMPLETED.value
                    self.events.emit(
                        session,
                        run_id=run_id,
                        event_type=RunEventType.STATUS,
                        message="Run completed.",
                        payload={"status": context.run.status},
                    )
                session.commit()
            except Exception as exc:  # noqa: BLE001
                self._mark_run_failed(session, run_id=run_id, message=f"Full run failed: {exc}", error=exc)
                session.commit()

    def _retry_failed_rows(self, run_id: str) -> None:
        with SessionLocal() as session:
            try:
                context = self._load_context(session, run_id)
                with self.events.agent_step(session, run_id=run_id, agent="Recovery", action="retry_failed_rows"):
                    failed_rows = list(
                        session.scalars(
                            select(RowResult).where(
                                RowResult.run_id == run_id,
                                RowResult.status.in_([RowStatus.FAILED.value, RowStatus.NEEDS_REVIEW.value]),
                            )
                        )
                    )
                    if not failed_rows:
                        return
                    dataframe = self.workbooks.load_sheet_dataframe(
                        session, file_id=context.run.file_id, sheet_name=context.plan.sheet_name
                    ).fillna("")
                    rows = dataframe.to_dict(orient="records")
                    for row_result in failed_rows:
                        self._process_row(
                            session,
                            context=context,
                            row_index=row_result.row_index,
                            row_data=rows[row_result.row_index],
                            save=True,
                        )
                session.commit()
            except Exception as exc:  # noqa: BLE001
                self._mark_run_failed(session, run_id=run_id, message=f"Retry failed: {exc}", error=exc)
                session.commit()

    def _process_row_in_new_session(self, run_id: str, row_index: int, row_data: dict[str, Any]) -> RowResultPayload:
        with SessionLocal() as session:
            context = self._load_context(session, run_id)
            payload = self._process_row(
                session,
                context=context,
                row_index=row_index,
                row_data=row_data,
                save=True,
            )
            session.commit()
            return payload

    def _process_row(
        self,
        session: Session,
        *,
        context: RunExecutionContext,
        row_index: int,
        row_data: dict[str, Any],
        save: bool,
    ) -> RowResultPayload:
        if context.run.cancel_requested:
            raise RuntimeError("Run has been cancelled.")
        row_key = str(row_data.get(context.plan.input_columns[0], row_index) if context.plan.input_columns else row_index)
        raw_response: dict[str, Any] = {}
        evidence = []
        try:
            profile, model_overridden = self.provider.resolve_model(
                requested_profile=context.plan.model_profile,
                requested_model_id=context.plan.model_id,
                require_web_research=True,
            )
            if model_overridden:
                self.events.emit(
                    session,
                    run_id=context.run.id,
                    event_type=RunEventType.MODEL_OVERRIDE,
                    message="Model overridden to a web-research-capable profile.",
                    payload={"row_index": row_index, "model_id": profile.model_id},
                )
            with self.events.agent_step(
                session,
                run_id=context.run.id,
                agent="Web Research",
                action="enrich_row",
                row_index=row_index,
            ):
                outputs, evidence, raw_response = self.research.enrich_row(
                    api_key=context.api_key,
                    plan=context.plan,
                    row_index=row_index,
                    row_data=row_data,
                    model=profile,
                    stricter=False,
                )
            with self.events.agent_step(
                session,
                run_id=context.run.id,
                agent="Validation",
                action="validate_row",
                row_index=row_index,
            ):
                normalized, validation_state, warnings, confidence = self.validation.validate_outputs(
                    outputs=outputs,
                    output_fields=context.plan.output_fields,
                    has_citations=bool(evidence),
                )
            retry_count = 0
            if validation_state == ValidationState.RETRYABLE and context.plan.retry_policy.max_retries_per_row > 0:
                retry_count = 1
                with self.events.agent_step(
                    session,
                    run_id=context.run.id,
                    agent="Recovery",
                    action="retry_row",
                    row_index=row_index,
                ):
                    outputs, evidence, raw_response = self.research.enrich_row(
                        api_key=context.api_key,
                        plan=context.plan,
                        row_index=row_index,
                        row_data=row_data,
                        model=profile,
                        stricter=True,
                    )
                    normalized, validation_state, warnings, confidence = self.validation.validate_outputs(
                        outputs=outputs,
                        output_fields=context.plan.output_fields,
                        has_citations=bool(evidence),
                    )
            payload = RowResultPayload(
                row_index=row_index,
                row_key=row_key,
                status={
                    ValidationState.VALID: RowStatus.COMPLETED,
                    ValidationState.RETRYABLE: RowStatus.FAILED,
                    ValidationState.NEEDS_REVIEW: RowStatus.NEEDS_REVIEW,
                }[validation_state],
                outputs=normalized,
                warnings=warnings,
                validation_state=validation_state,
                retry_count=retry_count,
                confidence=confidence,
                evidence_refs=[],
            )
        except Exception as exc:  # noqa: BLE001
            payload = RowResultPayload(
                row_index=row_index,
                row_key=row_key,
                status=RowStatus.FAILED,
                outputs={field.name: "" for field in context.plan.output_fields},
                warnings=[f"{exc.__class__.__name__}: {exc}"],
                validation_state=ValidationState.RETRYABLE,
                retry_count=0,
                confidence=0.0,
                evidence_refs=[],
            )
            raw_response = {
                "error": str(exc),
                "error_code": exc.__class__.__name__,
            }
            evidence = []
        if save:
            row_result = session.scalars(
                select(RowResult).where(RowResult.run_id == context.run.id, RowResult.row_index == row_index)
            ).first()
            if row_result is None:
                row_result = RowResult(
                    run_id=context.run.id,
                    row_index=row_index,
                    row_key=payload.row_key,
                    status=payload.status.value,
                    output_json=payload.outputs,
                    warnings_json=payload.warnings,
                    retry_count=payload.retry_count,
                    validation_state=payload.validation_state.value,
                    confidence=payload.confidence,
                    evidence_refs_json=[],
                )
                session.add(row_result)
                session.flush()
            else:
                row_result.row_key = payload.row_key
                row_result.status = payload.status.value
                row_result.output_json = payload.outputs
                row_result.warnings_json = payload.warnings
                row_result.retry_count = payload.retry_count
                row_result.validation_state = payload.validation_state.value
                row_result.confidence = payload.confidence
            session.execute(
                delete(ResearchEvidence).where(
                    ResearchEvidence.run_id == context.run.id,
                    ResearchEvidence.row_index == row_index,
                )
            )
            evidence_refs: list[str] = []
            for evidence_item in evidence:
                evidence_record = ResearchEvidence(
                    run_id=context.run.id,
                    row_index=row_index,
                    source_url=evidence_item.source_url,
                    title=evidence_item.title,
                    snippet=evidence_item.snippet,
                    citation_json=evidence_item.citation_metadata,
                    confidence_contribution=evidence_item.confidence_contribution,
                    retrieved_at=evidence_item.retrieved_at,
                )
                session.add(evidence_record)
                session.flush()
                evidence_refs.append(evidence_record.id)
            row_result.evidence_refs_json = evidence_refs
            payload.evidence_refs = evidence_refs
            self.events.emit(
                session,
                run_id=context.run.id,
                event_type=RunEventType.ROW_PROGRESS,
                message=f"Processed row {row_index}.",
                payload={
                    "row_index": row_index,
                    "status": payload.status.value,
                    "warnings": payload.warnings,
                    "raw_response": raw_response,
                },
            )
            session.flush()
        return payload

    def _persist_dry_run_artifact(self, session: Session, *, run_id: str, file_id: str, sheet_name: str) -> str:
        return self.export.export_dry_run(session, run_id=run_id, file_id=file_id, sheet_name=sheet_name)

    def _clear_existing_row_results(self, session: Session, *, run_id: str) -> None:
        session.execute(delete(ResearchEvidence).where(ResearchEvidence.run_id == run_id))
        session.execute(delete(RowResult).where(RowResult.run_id == run_id))
        session.flush()

    def _load_context(self, session: Session, run_id: str) -> RunExecutionContext:
        run = session.get(RunRecord, run_id)
        if run is None:
            raise ValueError("run not found")
        plan = self.planning.get_latest_plan(session, run_id, approved_only=True)
        if plan is None:
            raise ValueError("approved plan not found")
        api_key = self.settings_service.get_openrouter_key(session) or self.settings.openrouter_api_key
        if not api_key:
            raise ValueError("OpenRouter API key not configured")
        return RunExecutionContext(run=run, plan=plan, api_key=api_key)

    def _mark_run_failed(self, session: Session, *, run_id: str, message: str, error: Exception) -> None:
        run = session.get(RunRecord, run_id)
        if run is not None:
            run.status = RunStatus.FAILED.value
        self.events.emit(
            session,
            run_id=run_id,
            event_type=RunEventType.ERROR,
            message=message,
            payload={"error_code": error.__class__.__name__},
        )
        session.flush()


def resolve_concurrency(profile_id: str) -> int:
    profile, _ = OpenRouterClient().resolve_model(
        requested_profile=profile_id,
        requested_model_id=None,
        require_web_research=True,
    )
    return profile.recommended_concurrency
