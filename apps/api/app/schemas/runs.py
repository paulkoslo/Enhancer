from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.domain.runs.types import ArtifactKind, ExecutionMode, ModelProfile, OutputFieldDefinition, RunPlan
from app.domain.runs.types import RunStatus, ValidationState


class CreateRunRequest(BaseModel):
    file_id: str
    task: str
    sheet_name: str | None = None
    requested_model_profile: str | None = None
    requested_model_id: str | None = None
    advanced_mode: bool = False


class AddRunMessageRequest(BaseModel):
    content: str


class UpdateDraftPlanRequest(BaseModel):
    sheet_name: str | None = None
    enabled_output_fields: list[str] | None = None
    model_profile: str | None = None
    model_id: str | None = None


class RunMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class ArtifactResponse(BaseModel):
    id: str
    kind: ArtifactKind
    content_type: str
    metadata: dict[str, Any]
    created_at: datetime


class RowResultResponse(BaseModel):
    row_index: int
    row_key: str
    status: str
    output_json: dict[str, Any]
    warnings: list[str]
    retry_count: int
    validation_state: ValidationState
    confidence: float
    evidence_refs: list[str]


class DraftPlanControlsResponse(BaseModel):
    available_sheets: list[str] = Field(default_factory=list)
    available_output_fields: list[OutputFieldDefinition] = Field(default_factory=list)
    available_model_profiles: list[ModelProfile] = Field(default_factory=list)
    selected_sheet: str
    enabled_output_fields: list[str] = Field(default_factory=list)
    model_profile: str
    model_id: str | None = None


class RunResponse(BaseModel):
    id: str
    file_id: str
    status: RunStatus
    execution_mode: ExecutionMode
    selected_sheet: str
    task: str
    selected_model_profile: str
    selected_model_id: str | None
    requires_research: bool
    is_advanced_mode: bool
    created_at: datetime
    updated_at: datetime
    messages: list[RunMessageResponse] = Field(default_factory=list)
    draft_plan: RunPlan | None = None
    approved_plan: RunPlan | None = None
    draft_controls: DraftPlanControlsResponse | None = None
    row_results: list[RowResultResponse] = Field(default_factory=list)
    artifacts: list[ArtifactResponse] = Field(default_factory=list)
    latest_events: list[dict[str, Any]] = Field(default_factory=list)
