from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Artifact, RunEvent, RunMessage, RunRecord, RowResult
from app.db.session import SessionLocal, get_session
from app.domain.artifacts.service import ArtifactService
from app.domain.events.service import EventService
from app.domain.execution.service import ExecutionService
from app.domain.planning.service import PlanningService
from app.domain.provider.capabilities import list_profiles
from app.domain.runs.types import ArtifactKind, ExecutionMode, RunStatus, ValidationState
from app.schemas.runs import AddRunMessageRequest, ArtifactResponse, CreateRunRequest, DraftPlanControlsResponse
from app.schemas.runs import RowResultResponse, RunMessageResponse, RunResponse
from app.schemas.runs import UpdateDraftPlanRequest


router = APIRouter()
planning = PlanningService()
execution = ExecutionService()
events = EventService()
artifacts = ArtifactService()


def _serialize_run(session: Session, run: RunRecord) -> RunResponse:
    messages = list(session.scalars(select(RunMessage).where(RunMessage.run_id == run.id).order_by(RunMessage.created_at.asc())))
    row_results = list(
        session.scalars(select(RowResult).where(RowResult.run_id == run.id).order_by(RowResult.row_index.asc()))
    )
    artifact_rows = list(session.scalars(select(Artifact).where(Artifact.run_id == run.id).order_by(Artifact.created_at.asc())))
    draft_plan = planning.get_latest_plan(session, run.id)
    approved_plan = planning.get_latest_plan(session, run.id, approved_only=True)
    available_sheets = [sheet.sheet_name for sheet in planning.workbooks.list_sheets(session, run.file_id)]
    latest_events = [
        {
            "id": event.id,
            "type": event.event_type,
            "message": event.message,
            "payload": event.payload_json,
            "created_at": event.created_at.isoformat(),
        }
        for event in events.list_for_run(session, run.id)[-25:]
    ]
    return RunResponse(
        id=run.id,
        file_id=run.file_id,
        status=RunStatus(run.status),
        execution_mode=ExecutionMode(run.execution_mode),
        selected_sheet=run.selected_sheet,
        task=run.task,
        selected_model_profile=run.selected_model_profile,
        selected_model_id=run.selected_model_id,
        requires_research=run.requires_research,
        is_advanced_mode=run.is_advanced_mode,
        created_at=run.created_at,
        updated_at=run.updated_at,
        messages=[
            RunMessageResponse(id=message.id, role=message.role, content=message.content, created_at=message.created_at)
            for message in messages
        ],
        draft_plan=draft_plan,
        approved_plan=approved_plan,
        draft_controls=DraftPlanControlsResponse(
            available_sheets=available_sheets,
            available_output_fields=planning.get_available_output_fields(draft_plan or approved_plan),
            available_model_profiles=list_profiles(),
            selected_sheet=(draft_plan.sheet_name if draft_plan else run.selected_sheet),
            enabled_output_fields=[field.name for field in (draft_plan.output_fields if draft_plan else [])],
            model_profile=(draft_plan.model_profile if draft_plan else run.selected_model_profile),
            model_id=(draft_plan.model_id if draft_plan else run.selected_model_id),
        ),
        row_results=[
            RowResultResponse(
                row_index=result.row_index,
                row_key=result.row_key,
                status=result.status,
                output_json=result.output_json,
                warnings=result.warnings_json,
                retry_count=result.retry_count,
                validation_state=ValidationState(result.validation_state),
                confidence=result.confidence,
                evidence_refs=result.evidence_refs_json,
            )
            for result in row_results
        ],
        artifacts=[
            ArtifactResponse(
                id=artifact.id,
                kind=ArtifactKind(artifact.kind),
                content_type=artifact.content_type,
                metadata=artifact.metadata_json,
                created_at=artifact.created_at,
            )
            for artifact in artifact_rows
        ],
        latest_events=latest_events,
    )


def _get_run_or_404(session: Session, run_id: str) -> RunRecord:
    run = session.get(RunRecord, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("", response_model=RunResponse)
def create_run(payload: CreateRunRequest, session: Session = Depends(get_session)) -> RunResponse:
    try:
        result = planning.create_run(
            session,
            file_id=payload.file_id,
            task=payload.task,
            sheet_name=payload.sheet_name,
            requested_model_profile=payload.requested_model_profile,
            requested_model_id=payload.requested_model_id,
            advanced_mode=payload.advanced_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    session.commit()
    session.refresh(result.run)
    return _serialize_run(session, result.run)


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: str, session: Session = Depends(get_session)) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    return _serialize_run(session, run)


@router.post("/{run_id}/messages", response_model=RunResponse)
def add_run_message(
    run_id: str,
    payload: AddRunMessageRequest,
    session: Session = Depends(get_session),
) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    try:
        planning.add_message(session, run=run, content=payload.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    session.commit()
    return _serialize_run(session, run)


@router.patch("/{run_id}/plan/draft", response_model=RunResponse)
def update_draft_plan(
    run_id: str,
    payload: UpdateDraftPlanRequest,
    session: Session = Depends(get_session),
) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    try:
        planning.update_draft_plan(
            session,
            run=run,
            sheet_name=payload.sheet_name,
            enabled_output_fields=payload.enabled_output_fields,
            model_profile=payload.model_profile,
            model_id=payload.model_id,
            prompt_template=payload.prompt_template,
            stricter_prompt_template=payload.stricter_prompt_template,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    session.commit()
    return _serialize_run(session, run)


@router.post("/{run_id}/plan/approve", response_model=RunResponse)
def approve_plan(run_id: str, session: Session = Depends(get_session)) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    planning.approve_plan(session, run)
    session.commit()
    return _serialize_run(session, run)


@router.post("/{run_id}/dry-run", response_model=RunResponse)
def start_dry_run(run_id: str, session: Session = Depends(get_session)) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    execution.start_dry_run(session, run=run)
    session.commit()
    execution.dispatch_dry_run(run.id)
    session.refresh(run)
    return _serialize_run(session, run)


@router.post("/{run_id}/dry-run/approve", response_model=RunResponse)
def approve_dry_run(run_id: str, session: Session = Depends(get_session)) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    execution.approve_dry_run(session, run=run)
    session.commit()
    return _serialize_run(session, run)


@router.post("/{run_id}/execute", response_model=RunResponse)
def execute_run(run_id: str, session: Session = Depends(get_session)) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    execution.queue_full_run(session, run=run)
    session.commit()
    execution.dispatch_full_run(run.id)
    session.refresh(run)
    return _serialize_run(session, run)


@router.post("/{run_id}/actions/{action}", response_model=RunResponse)
def apply_run_action(run_id: str, action: str, session: Session = Depends(get_session)) -> RunResponse:
    run = _get_run_or_404(session, run_id)
    execution.perform_action(session, run=run, action=action)
    session.commit()
    return _serialize_run(session, run)


@router.get("/{run_id}/events")
def stream_events(run_id: str, session: Session = Depends(get_session)) -> StreamingResponse:
    _get_run_or_404(session, run_id)
    generator = events.stream(SessionLocal, run_id)
    return StreamingResponse(generator, media_type="text/event-stream")


@router.get("/{run_id}/download")
def download_run_output(run_id: str, session: Session = Depends(get_session)):
    _get_run_or_404(session, run_id)
    artifact = session.scalars(
        select(Artifact)
        .where(Artifact.run_id == run_id, Artifact.kind == ArtifactKind.FINAL_WORKBOOK.value)
        .order_by(Artifact.created_at.desc())
    ).first()
    if artifact is None:
        raise HTTPException(status_code=404, detail="No downloadable artifact yet.")
    return StreamingResponse(
        iter([artifacts.read_bytes(artifact)]),
        media_type=artifact.content_type,
        headers={"Content-Disposition": f'attachment; filename="{artifact.metadata_json.get("filename", "enhanced.xlsx")}"'},
    )


@router.get("/{run_id}/dry-run/download")
def download_dry_run_output(run_id: str, session: Session = Depends(get_session)):
    _get_run_or_404(session, run_id)
    artifact = session.scalars(
        select(Artifact)
        .where(Artifact.run_id == run_id, Artifact.kind == ArtifactKind.DRY_RUN_RESULTS.value)
        .order_by(Artifact.created_at.desc())
    ).first()
    if artifact is None:
        raise HTTPException(status_code=404, detail="No dry-run artifact yet.")
    return StreamingResponse(
        iter([artifacts.read_bytes(artifact)]),
        media_type=artifact.content_type,
        headers={"Content-Disposition": f'attachment; filename="{artifact.metadata_json.get("filename", "dry-run.xlsx")}"'},
    )
