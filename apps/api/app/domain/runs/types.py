from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ExecutionMode(str, Enum):
    DECLARATIVE = "declarative"
    SCRIPT = "script"


class RunStatus(str, Enum):
    UPLOADED = "uploaded"
    PROFILED = "profiled"
    PLANNING = "planning"
    AWAITING_PLAN_APPROVAL = "awaiting_plan_approval"
    DRY_RUN_PREPARING = "dry_run_preparing"
    DRY_RUN_RUNNING = "dry_run_running"
    DRY_RUN_REVIEW = "dry_run_review"
    AWAITING_FINAL_APPROVAL = "awaiting_final_approval"
    FULL_RUN_QUEUED = "full_run_queued"
    FULL_RUN_RUNNING = "full_run_running"
    RECOVERING_FAILED_ROWS = "recovering_failed_rows"
    EXPORTING = "exporting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class RowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"
    FAILED = "failed"


class ValidationState(str, Enum):
    VALID = "valid"
    RETRYABLE = "retryable"
    NEEDS_REVIEW = "needs_review"


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class ArtifactKind(str, Enum):
    UPLOAD = "upload"
    PLAN_SNAPSHOT = "plan_snapshot"
    PREVIEW = "preview"
    DRY_RUN_RESULTS = "dry_run_results"
    GENERATED_CODE = "generated_code"
    GENERATED_TESTS = "generated_tests"
    LOG = "log"
    FINAL_WORKBOOK = "final_workbook"
    AUDIT_REPORT = "audit_report"


class RunEventType(str, Enum):
    AGENT = "agent"
    STATUS = "status"
    MESSAGE = "message"
    DRY_RUN = "dry_run"
    ROW_PROGRESS = "row_progress"
    MODEL_OVERRIDE = "model_override"
    SANDBOX = "sandbox"
    EXPORT = "export"
    ERROR = "error"


class OutputFieldDefinition(BaseModel):
    name: str
    description: str
    required: bool = True
    field_type: str = "string"


class ResearchPolicy(BaseModel):
    required: bool = True
    mode: str = "model_web_search"
    max_sources_per_row: int = 5


class RetryPolicy(BaseModel):
    max_retries_per_row: int = 1
    retry_on_missing_citations: bool = True
    retry_on_invalid_url: bool = True


class BudgetPolicy(BaseModel):
    max_usd: float = 25.0
    soft_limit_usd: float = 15.0


class ExportPolicy(BaseModel):
    preserve_row_order: bool = True
    include_audit_sheet: bool = True
    output_format: str = "xlsx"


class ModelProfile(BaseModel):
    profile_id: str
    provider: str
    model_id: str
    display_name: str
    supports_web_research: bool
    supports_structured_output: bool
    cost_tier: str
    latency_tier: str
    recommended_concurrency: int = 4


class ResearchEvidenceRecord(BaseModel):
    row_index: int
    source_url: str
    title: str | None = None
    snippet: str | None = None
    citation_metadata: dict[str, Any] = Field(default_factory=dict)
    retrieved_at: datetime = Field(default_factory=datetime.utcnow)
    confidence_contribution: float = 0.5


class RowResultPayload(BaseModel):
    row_index: int
    row_key: str
    status: RowStatus
    outputs: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    validation_state: ValidationState = ValidationState.VALID
    retry_count: int = 0
    confidence: float = 0.0
    evidence_refs: list[str] = Field(default_factory=list)


class RunPlan(BaseModel):
    execution_mode: ExecutionMode
    sheet_name: str
    task: str
    input_columns: list[str]
    output_fields: list[OutputFieldDefinition]
    prompt_template: str
    stricter_prompt_template: str
    model_profile: str
    model_id: str | None = None
    sample_row_indices: list[int] = Field(default_factory=list)
    research_policy: ResearchPolicy = Field(default_factory=ResearchPolicy)
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    budget_policy: BudgetPolicy = Field(default_factory=BudgetPolicy)
    export_policy: ExportPolicy = Field(default_factory=ExportPolicy)
    notes: list[str] = Field(default_factory=list)


class RunEventPayload(BaseModel):
    type: RunEventType
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
