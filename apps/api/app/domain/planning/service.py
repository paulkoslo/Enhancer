from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import FileRecord, PlanVersion, RunMessage, RunRecord
from app.domain.events.service import EventService
from app.domain.provider.openrouter import OpenRouterClient
from app.domain.runs.types import ExecutionMode, MessageRole, OutputFieldDefinition, RunEventType
from app.domain.runs.types import RunPlan, RunStatus
from app.domain.settings.service import SettingsService
from app.domain.workbooks.service import WorkbookService


TASK_KEYWORDS = {
    "website": OutputFieldDefinition(
        name="Website",
        description="Official company website URL. Prefer verified official domain only.",
    ),
    "size": OutputFieldDefinition(
        name="Company Size",
        description="Approximate company size from public sources. Use a concise textual estimate.",
    ),
    "industry": OutputFieldDefinition(
        name="Industry",
        description="Primary industry or category. Keep concise and specific.",
    ),
    "summary": OutputFieldDefinition(
        name="Summary",
        description="Short factual summary of what the company does. One or two sentences maximum.",
    ),
}

TASK_FIELD_ALIASES = {
    "Website": ["website", "company website", "domain", "homepage", "url"],
    "Company Size": ["company size", "size", "employee count", "employees", "headcount"],
    "Industry": ["industry", "sector", "category", "vertical"],
    "Summary": ["summary", "description", "company summary", "what they do"],
}

NEGATION_PATTERNS = (
    "remove",
    "drop",
    "exclude",
    "without",
    "don't need",
    "dont need",
    "do not need",
    "skip",
    "no",
)

ADDITION_PATTERNS = (
    "add",
    "include",
    "also include",
    "also add",
    "want",
    "need",
)

PLANNING_MODEL_PROFILE = "balanced"


@dataclass(slots=True)
class PlanningResult:
    run: RunRecord
    plan: RunPlan
    model_overridden: bool


@dataclass(slots=True)
class BuiltPlanResult:
    plan: RunPlan
    assistant_response: str


class PlanningBlueprint(BaseModel):
    output_fields: list[OutputFieldDefinition] = Field(default_factory=list)
    prompt_template: str
    stricter_prompt_template: str
    assistant_response: str


class PlanningService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.workbooks = WorkbookService()
        self.events = EventService()
        self.provider = OpenRouterClient()
        self.settings_service = SettingsService()

    def create_run(
        self,
        session: Session,
        *,
        file_id: str,
        task: str,
        sheet_name: str | None,
        requested_model_profile: str | None,
        requested_model_id: str | None,
        advanced_mode: bool,
    ) -> PlanningResult:
        file_record = session.get(FileRecord, file_id)
        if file_record is None:
            raise ValueError("file not found")
        sheets = self.workbooks.list_sheets(session, file_id)
        if not sheets:
            raise ValueError("file has no readable sheets")
        selected_sheet = sheet_name or sheets[0].sheet_name
        execution_mode = self._select_execution_mode(task=task, advanced_mode=advanced_mode)
        profile, model_overridden = self.provider.resolve_model(
            requested_profile=requested_model_profile,
            requested_model_id=requested_model_id,
            require_web_research=True,
        )
        run = RunRecord(
            file_id=file_id,
            status=RunStatus.PLANNING.value,
            execution_mode=execution_mode.value,
            selected_sheet=selected_sheet,
            task=task,
            selected_model_profile=profile.profile_id,
            selected_model_id=profile.model_id,
            requires_research=True,
            is_advanced_mode=advanced_mode,
            metadata_json={"feedback_history": []},
        )
        session.add(run)
        session.flush()
        with self.events.agent_step(session, run_id=run.id, agent="Orchestrator", action="create_run"):
            session.add(RunMessage(run_id=run.id, role=MessageRole.USER.value, content=task))
            with self.events.agent_step(session, run_id=run.id, agent="File Analyst", action="profile_sheet"):
                file_analysis_summary = self._build_file_analysis_summary(session, file_id=file_id, sheet_name=selected_sheet)
            with self.events.agent_step(
                session,
                run_id=run.id,
                agent="Task Planner",
                action="draft_plan",
                payload=self._planning_event_payload(task_label="Initial plan draft"),
            ):
                built_plan = self._build_plan(
                    session,
                    run=run,
                    task=task,
                    selected_sheet=selected_sheet,
                    requested_model_profile=profile.profile_id,
                    requested_model_id=profile.model_id,
                    model_overridden=model_overridden,
                    file_analysis_summary=file_analysis_summary,
                )
                plan = built_plan.plan
            self._save_plan_version(session, run_id=run.id, plan=plan)
            session.add(
                RunMessage(
                    run_id=run.id,
                    role=MessageRole.ASSISTANT.value,
                    content=built_plan.assistant_response,
                )
            )
            run.status = RunStatus.AWAITING_PLAN_APPROVAL.value
            self.events.emit(
                session,
                run_id=run.id,
                event_type=RunEventType.STATUS,
                message="Plan drafted and awaiting approval.",
                payload={"status": run.status},
            )
            session.flush()
        return PlanningResult(run=run, plan=plan, model_overridden=model_overridden)

    def add_message(
        self,
        session: Session,
        *,
        run: RunRecord,
        content: str,
    ) -> RunPlan:
        with self.events.agent_step(session, run_id=run.id, agent="Orchestrator", action="handle_feedback"):
            session.add(RunMessage(run_id=run.id, role=MessageRole.USER.value, content=content))
            latest = self.get_latest_plan(session, run.id)
            selected_sheet = latest.sheet_name if latest else run.selected_sheet
            selected_fields = latest.output_fields if latest else []
            updated_metadata = self._append_feedback_history(run.metadata_json, content)
            feedback_history = self._get_feedback_history(updated_metadata)
            updated_fields, changes = self._apply_feedback_to_output_fields(selected_fields, content)
            with self.events.agent_step(
                session,
                run_id=run.id,
                agent="Task Planner",
                action="refine_plan",
                payload=self._planning_event_payload(task_label="Plan refinement"),
            ):
                built_plan = self._build_plan(
                    session,
                    run=run,
                    task=run.task,
                    selected_sheet=selected_sheet,
                    requested_model_profile=(latest.model_profile if latest else run.selected_model_profile),
                    requested_model_id=(latest.model_id if latest else run.selected_model_id),
                    model_overridden=False,
                    current_output_fields=selected_fields,
                    fallback_output_fields=updated_fields,
                    feedback_history=feedback_history,
                )
                plan = built_plan.plan
            changes = self._describe_output_field_changes(before=selected_fields, after=plan.output_fields)
            self._save_plan_version(session, run_id=run.id, plan=plan)
            run.status = RunStatus.AWAITING_PLAN_APPROVAL.value
            run.selected_sheet = plan.sheet_name
            run.selected_model_profile = plan.model_profile
            run.selected_model_id = plan.model_id
            run.metadata_json = updated_metadata
            self.events.emit(
                session,
                run_id=run.id,
                event_type=RunEventType.MESSAGE,
                message="Plan updated from user feedback.",
                payload={"status": run.status},
            )
            session.add(
                RunMessage(
                    run_id=run.id,
                    role=MessageRole.ASSISTANT.value,
                    content=built_plan.assistant_response,
                )
            )
            session.flush()
        return plan

    def update_draft_plan(
        self,
        session: Session,
        *,
        run: RunRecord,
        sheet_name: str | None,
        enabled_output_fields: list[str] | None,
        model_profile: str | None,
        model_id: str | None,
        prompt_template: str | None = None,
        stricter_prompt_template: str | None = None,
    ) -> RunPlan:
        with self.events.agent_step(session, run_id=run.id, agent="Orchestrator", action="patch_draft_plan"):
            latest = self.get_latest_plan(session, run.id)
            if latest is None:
                raise ValueError("no plan draft available")
            requested_profile = model_profile or latest.model_profile
            requested_model_id = model_id if model_id is not None else latest.model_id
            profile, model_overridden = self.provider.resolve_model(
                requested_profile=requested_profile,
                requested_model_id=requested_model_id,
                require_web_research=True,
            )
            resolved_fields = self._resolve_output_fields(enabled_output_fields, fallback=latest.output_fields)
            with self.events.agent_step(
                session,
                run_id=run.id,
                agent="Task Planner",
                action="patch_draft",
                payload=self._planning_event_payload(task_label="Draft plan update"),
            ):
                built_plan = self._build_plan(
                    session,
                    run=run,
                    task=run.task,
                    selected_sheet=sheet_name or latest.sheet_name,
                    requested_model_profile=profile.profile_id,
                    requested_model_id=profile.model_id,
                    model_overridden=model_overridden,
                    current_output_fields=latest.output_fields,
                    fallback_output_fields=resolved_fields,
                    lock_output_fields=True,
                    feedback_history=self._get_feedback_history(run.metadata_json),
                )
                plan = built_plan.plan
            if prompt_template is not None or stricter_prompt_template is not None:
                plan = plan.model_copy(
                    update={
                        "prompt_template": self._normalize_prompt_text(prompt_template, fallback=plan.prompt_template),
                        "stricter_prompt_template": self._normalize_prompt_text(
                            stricter_prompt_template,
                            fallback=plan.stricter_prompt_template,
                        ),
                    }
                )
            self._save_plan_version(session, run_id=run.id, plan=plan)
            run.selected_sheet = plan.sheet_name
            run.selected_model_profile = plan.model_profile
            run.selected_model_id = plan.model_id
            run.status = RunStatus.AWAITING_PLAN_APPROVAL.value
            self.events.emit(
                session,
                run_id=run.id,
                event_type=RunEventType.MESSAGE,
                message="Draft plan controls updated.",
                payload={
                    "status": run.status,
                    "sheet_name": plan.sheet_name,
                    "enabled_output_fields": [field.name for field in plan.output_fields],
                    "model_profile": plan.model_profile,
                },
            )
            session.flush()
        return plan

    def approve_plan(self, session: Session, run: RunRecord) -> RunPlan:
        stmt = select(PlanVersion).where(PlanVersion.run_id == run.id).order_by(PlanVersion.version.desc())
        version = session.scalars(stmt).first()
        if version is None:
            raise ValueError("no plan draft available")
        version.is_approved = True
        run.status = RunStatus.DRY_RUN_PREPARING.value
        self.events.emit(
            session,
            run_id=run.id,
            event_type=RunEventType.STATUS,
            message="Plan approved.",
            payload={"status": run.status},
        )
        session.flush()
        return RunPlan.model_validate(version.plan_json)

    def get_latest_plan(self, session: Session, run_id: str, approved_only: bool = False) -> RunPlan | None:
        stmt = select(PlanVersion).where(PlanVersion.run_id == run_id)
        if approved_only:
            stmt = stmt.where(PlanVersion.is_approved.is_(True))
        stmt = stmt.order_by(PlanVersion.version.desc())
        version = session.scalars(stmt).first()
        if version is None:
            return None
        return RunPlan.model_validate(version.plan_json)

    def _save_plan_version(self, session: Session, *, run_id: str, plan: RunPlan) -> PlanVersion:
        stmt = select(func.max(PlanVersion.version)).where(PlanVersion.run_id == run_id)
        latest_version = session.scalar(stmt) or 0
        version = PlanVersion(
            run_id=run_id,
            version=latest_version + 1,
            is_approved=False,
            plan_json=plan.model_dump(mode="json"),
            prompt_bundle_json={
                "prompt_template": plan.prompt_template,
                "stricter_prompt_template": plan.stricter_prompt_template,
            },
        )
        session.add(version)
        session.flush()
        return version

    def _build_plan(
        self,
        session: Session,
        *,
        run: RunRecord,
        task: str,
        selected_sheet: str,
        requested_model_profile: str,
        requested_model_id: str | None,
        model_overridden: bool,
        current_output_fields: list[OutputFieldDefinition] | None = None,
        fallback_output_fields: list[OutputFieldDefinition] | None = None,
        lock_output_fields: bool = False,
        feedback_history: list[str] | None = None,
        file_analysis_summary: str | None = None,
    ) -> BuiltPlanResult:
        sheet = next(
            sheet for sheet in self.workbooks.list_sheets(session, run.file_id) if sheet.sheet_name == selected_sheet
        )
        feedback_history = feedback_history or []
        fallback_fields = fallback_output_fields or current_output_fields or self._infer_output_fields(task)
        ai_blueprint = self._generate_ai_blueprint(
            session,
            task=task,
            selected_sheet=selected_sheet,
            sheet_profile=sheet.profile_json,
            preview_rows=sheet.preview_json,
            current_output_fields=current_output_fields or fallback_fields,
            locked_output_fields=fallback_fields if lock_output_fields else None,
            feedback_history=feedback_history,
            file_analysis_summary=file_analysis_summary,
        )
        output_fields = fallback_fields if lock_output_fields else ai_blueprint.output_fields
        input_columns = self._infer_input_columns(sheet.profile_json)
        sample_row_indices = self._pick_sample_rows(sheet.preview_json)
        with self.events.agent_step(session, run_id=run.id, agent="Prompt/Schema", action="build_prompt_bundle"):
            prompt_template = ai_blueprint.prompt_template.strip()
            stricter_prompt = ai_blueprint.stricter_prompt_template.strip()
        notes = [
            "Research is mandatory for this enrichment task.",
            "Model-native web search is used through OpenRouter.",
            "AI planning uses the fast planning model profile.",
        ]
        if model_overridden:
            notes.append("Selected model was overridden to a web-research-capable profile.")
        return BuiltPlanResult(
            plan=RunPlan(
                execution_mode=ExecutionMode(run.execution_mode),
                sheet_name=selected_sheet,
                task=task,
                input_columns=input_columns,
                output_fields=output_fields,
                prompt_template=prompt_template,
                stricter_prompt_template=stricter_prompt,
                model_profile=requested_model_profile,
                model_id=requested_model_id,
                sample_row_indices=sample_row_indices,
                notes=notes,
            ),
            assistant_response=ai_blueprint.assistant_response.strip(),
        )

    def _planning_event_payload(self, *, task_label: str) -> dict[str, Any]:
        model, _ = self.provider.resolve_model(
            requested_profile=PLANNING_MODEL_PROFILE,
            requested_model_id=None,
            require_web_research=False,
        )
        return {
            "task_label": task_label,
            "model_profile": model.profile_id,
            "model_id": model.model_id,
        }

    def _normalize_prompt_text(self, value: str | None, *, fallback: str) -> str:
        if value is None:
            return fallback
        cleaned = value.strip()
        return cleaned or fallback

    def _generate_ai_blueprint(
        self,
        session: Session,
        *,
        task: str,
        selected_sheet: str,
        sheet_profile: dict[str, Any],
        preview_rows: list[dict[str, Any]],
        current_output_fields: list[OutputFieldDefinition],
        locked_output_fields: list[OutputFieldDefinition] | None,
        feedback_history: list[str],
        file_analysis_summary: str | None = None,
    ) -> PlanningBlueprint:
        api_key = self._resolve_planning_api_key(session)
        if not api_key:
            raise ValueError("OpenRouter API key not configured for AI planning.")
        model, _ = self.provider.resolve_model(
            requested_profile=PLANNING_MODEL_PROFILE,
            requested_model_id=None,
            require_web_research=False,
        )
        output_field_lines = "\n".join(
            f"- {field.name}: {field.description}" for field in current_output_fields
        ) or "- none"
        locked_field_lines = "\n".join(
            f"- {field.name}: {field.description}" for field in (locked_output_fields or [])
        ) or "- none"
        feedback_lines = "\n".join(f"- {item}" for item in feedback_history[-6:]) or "- none"
        file_summary = file_analysis_summary or "No additional file analysis summary provided."
        profile_summary = {
            "entity_type": sheet_profile.get("entity_type"),
            "columns": sheet_profile.get("columns", []),
            "candidate_columns": sheet_profile.get("candidate_columns", {}),
        }
        user_prompt = (
            "Plan a spreadsheet enrichment task.\n\n"
            f"Original task:\n{task}\n\n"
            "Accepted refinements:\n"
            f"{feedback_lines}\n\n"
            "File analyst summary:\n"
            f"{file_summary}\n\n"
            f"Selected sheet: {selected_sheet}\n"
            "Sheet profile:\n"
            f"{profile_summary}\n\n"
            "Preview rows:\n"
            f"{preview_rows[:3]}\n\n"
            "Current output fields:\n"
            f"{output_field_lines}\n\n"
            "Locked output fields:\n"
            f"{locked_field_lines}\n\n"
            "Requirements:\n"
            "- Keep the original task as the stable top-level objective.\n"
            "- Interpret refinements intelligently and manage output fields accordingly.\n"
            "- You may create custom output fields that are not in any predefined catalog.\n"
            "- Output field names must be short, spreadsheet-friendly, and distinct.\n"
            "- Prompt templates must ask for exactly the returned fields plus a numeric confidence.\n"
            "- The stricter prompt must prefer blanks over guesses and be more conservative.\n"
            "- assistant_response must explain what changed in plain language for the user.\n"
        )
        try:
            response = self.provider.structured_json(
                api_key=api_key,
                model=model,
                system_prompt=(
                    "You are the Enhancer Planning Agent. Use a fast planning model to adapt spreadsheet enrichment "
                    "plans. Return output fields, prompt templates, and a concise assistant response as valid JSON."
                ),
                user_prompt=user_prompt,
                json_schema=self._planning_blueprint_schema(),
            )
            blueprint = PlanningBlueprint.model_validate(response.data)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"AI planning failed: {exc}") from exc
        sanitized_fields = self._sanitize_output_fields(
            locked_output_fields or blueprint.output_fields,
            fallback=current_output_fields,
        )
        prompt_template = blueprint.prompt_template.strip()
        stricter_prompt_template = blueprint.stricter_prompt_template.strip()
        assistant_response = blueprint.assistant_response.strip()
        if not prompt_template or not stricter_prompt_template or not assistant_response:
            raise ValueError("AI planning returned an incomplete plan.")
        return PlanningBlueprint(
            output_fields=sanitized_fields,
            prompt_template=prompt_template,
            stricter_prompt_template=stricter_prompt_template,
            assistant_response=assistant_response,
        )

    def _resolve_planning_api_key(self, session: Session) -> str | None:
        return self.settings_service.get_openrouter_key(session) or self.settings.openrouter_api_key

    def _sanitize_output_fields(
        self,
        fields: list[OutputFieldDefinition],
        *,
        fallback: list[OutputFieldDefinition],
    ) -> list[OutputFieldDefinition]:
        cleaned: list[OutputFieldDefinition] = []
        seen: set[str] = set()
        for field in fields:
            name = str(field.name).strip()
            description = str(field.description).strip()
            if not name or not description or name.lower() == "confidence" or name in seen:
                continue
            cleaned.append(
                OutputFieldDefinition(
                    name=name[:80],
                    description=description[:240],
                    required=field.required,
                    field_type=field.field_type,
                )
            )
            seen.add(name)
        return cleaned or [field.model_copy(deep=True) for field in fallback]

    def _planning_blueprint_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "output_fields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "required": {"type": "boolean"},
                            "field_type": {"type": "string"},
                        },
                        "required": ["name", "description", "required", "field_type"],
                        "additionalProperties": False,
                    },
                },
                "prompt_template": {"type": "string"},
                "stricter_prompt_template": {"type": "string"},
                "assistant_response": {"type": "string"},
            },
            "required": [
                "output_fields",
                "prompt_template",
                "stricter_prompt_template",
                "assistant_response",
            ],
            "additionalProperties": False,
        }

    def _select_execution_mode(self, *, task: str, advanced_mode: bool) -> ExecutionMode:
        if (
            advanced_mode
            and self.settings.enable_advanced_sandbox
            and any(keyword in task.lower() for keyword in ["script", "python", "custom code"])
        ):
            return ExecutionMode.SCRIPT
        return ExecutionMode.DECLARATIVE

    def _infer_output_fields(self, task: str) -> list[OutputFieldDefinition]:
        lowered = task.lower()
        selected = [field for keyword, field in TASK_KEYWORDS.items() if keyword in lowered]
        if not selected:
            selected = [TASK_KEYWORDS["summary"]]
        return selected

    def get_available_output_fields(self, plan: RunPlan | None = None) -> list[OutputFieldDefinition]:
        ordered: list[OutputFieldDefinition] = [field.model_copy(deep=True) for field in TASK_KEYWORDS.values()]
        seen = {field.name for field in ordered}
        if plan:
            for field in plan.output_fields:
                if field.name in seen:
                    continue
                ordered.append(field.model_copy(deep=True))
                seen.add(field.name)
        return ordered

    def _infer_input_columns(self, profile_json: dict[str, Any]) -> list[str]:
        candidate_columns = profile_json.get("candidate_columns", {})
        ordered = [
            candidate_columns.get("company"),
            candidate_columns.get("website"),
            candidate_columns.get("address"),
            candidate_columns.get("city"),
            candidate_columns.get("country"),
        ]
        selected = [column for column in ordered if column]
        if selected:
            return selected
        return list(profile_json.get("columns", []))[:3]

    def _pick_sample_rows(self, preview_json: list[dict[str, Any]]) -> list[int]:
        return list(range(min(len(preview_json), self.settings.dry_run_sample_size)))

    def _build_prompt(self, *, task: str, output_fields: list[OutputFieldDefinition], stricter: bool) -> str:
        field_lines = "\n".join(f"- {field.name}: {field.description}" for field in output_fields)
        strict_clause = (
            "Only return information grounded in current public web sources. "
            "If a field cannot be verified, return an empty string and lower confidence."
        )
        if stricter:
            strict_clause = (
                "Be stricter. Do not guess. Prefer blank values over uncertain claims. "
                "Only include an official website if it is clearly verified."
            )
        return (
            "You are the Enhancer Web Research Agent.\n"
            "Research the row using web search and return structured JSON.\n"
            f"User task:\n{task}\n"
            f"{strict_clause}\n"
            "Requested fields:\n"
            f"{field_lines}\n"
            "Also return a numeric confidence between 0 and 1."
        )

    def _build_file_analysis_summary(self, session: Session, *, file_id: str, sheet_name: str) -> str:
        sheet = next(
            sheet for sheet in self.workbooks.list_sheets(session, file_id) if sheet.sheet_name == sheet_name
        )
        profile = sheet.profile_json
        entity_type = profile.get("entity_type", "table")
        candidate_columns = profile.get("candidate_columns", {})
        return (
            f"This workbook appears to contain a {entity_type} table on sheet '{sheet_name}'. "
            f"Likely company column: {candidate_columns.get('company') or 'not detected'}. "
            f"I drafted a research-first enrichment plan using columns: "
            f"{', '.join(filter(None, self._infer_input_columns(profile)))}."
        )

    def _compose_task_text(self, *, task: str, feedback_history: list[str]) -> str:
        if not feedback_history:
            return task
        lines = "\n".join(f"- {item}" for item in feedback_history[-6:])
        return f"{task}\n\nAccepted refinements:\n{lines}"

    def _append_feedback_history(self, metadata: dict[str, Any], feedback: str) -> dict[str, Any]:
        updated = dict(metadata or {})
        history = list(updated.get("feedback_history", []))
        history.append(feedback)
        updated["feedback_history"] = history[-12:]
        return updated

    def _get_feedback_history(self, metadata: dict[str, Any] | None) -> list[str]:
        if not isinstance(metadata, dict):
            return []
        return list(metadata.get("feedback_history", []))

    def _apply_feedback_to_output_fields(
        self,
        base_fields: list[OutputFieldDefinition],
        feedback: str,
    ) -> tuple[list[OutputFieldDefinition], list[str]]:
        selected_names = {field.name for field in base_fields} or {field.name for field in self._infer_output_fields(feedback)}
        lowered = self._normalize_feedback(feedback)
        changes: list[str] = []
        for field_name, aliases in TASK_FIELD_ALIASES.items():
            if not self._contains_alias(lowered, aliases):
                continue
            if self._matches_feedback_pattern(lowered, aliases, NEGATION_PATTERNS):
                if field_name in selected_names:
                    selected_names.remove(field_name)
                    changes.append(f"Removed output field '{field_name}'.")
                continue
            if self._matches_feedback_pattern(lowered, aliases, ADDITION_PATTERNS):
                if field_name not in selected_names:
                    selected_names.add(field_name)
                    changes.append(f"Added output field '{field_name}'.")
        if not selected_names:
            selected_names.add("Summary")
            changes.append("Kept 'Summary' enabled so the draft plan stays valid.")
        ordered_names = [field.name for field in self.get_available_output_fields() if field.name in selected_names]
        ordered = self._resolve_output_fields(ordered_names, fallback=self.get_available_output_fields())
        return ordered, changes

    def _resolve_output_fields(
        self,
        names: list[str] | None,
        *,
        fallback: list[OutputFieldDefinition],
    ) -> list[OutputFieldDefinition]:
        if names is None:
            return [field.model_copy(deep=True) for field in fallback]
        if not names:
            return [TASK_KEYWORDS["summary"].model_copy(deep=True)]
        catalog = {field.name: field.model_copy(deep=True) for field in fallback}
        for field in self.get_available_output_fields():
            catalog[field.name] = field.model_copy(deep=True)
        resolved = [catalog[name].model_copy(deep=True) for name in names if name in catalog]
        return resolved or [field.model_copy(deep=True) for field in fallback]

    def _build_feedback_confirmation(self, *, changes: list[str], plan: RunPlan) -> str:
        if not changes:
            return (
                "I refreshed the draft plan instructions. The structure is unchanged and the active output fields are: "
                + ", ".join(field.name for field in plan.output_fields)
                + "."
            )
        return (
            "Updated the draft plan.\n"
            + "\n".join(f"- {change}" for change in changes)
            + f"\nCurrent output fields: {', '.join(field.name for field in plan.output_fields)}."
        )

    def _describe_output_field_changes(
        self,
        *,
        before: list[OutputFieldDefinition],
        after: list[OutputFieldDefinition],
    ) -> list[str]:
        before_names = {field.name for field in before}
        after_names = {field.name for field in after}
        changes: list[str] = []
        for name in sorted(after_names - before_names):
            changes.append(f"Added output field '{name}'.")
        for name in sorted(before_names - after_names):
            changes.append(f"Removed output field '{name}'.")
        return changes

    @staticmethod
    def _normalize_feedback(feedback: str) -> str:
        lowered = feedback.lower().replace("'", "")
        lowered = re.sub(r"[^\w\s-]", " ", lowered)
        return re.sub(r"\s+", " ", lowered).strip()

    @staticmethod
    def _contains_alias(lowered: str, aliases: list[str]) -> bool:
        return any(alias in lowered for alias in aliases)

    @staticmethod
    def _matches_feedback_pattern(lowered: str, aliases: list[str], patterns: tuple[str, ...]) -> bool:
        for alias in aliases:
            for pattern in patterns:
                if f"{pattern} {alias}" in lowered or f"{alias} {pattern}" in lowered:
                    return True
        return False
