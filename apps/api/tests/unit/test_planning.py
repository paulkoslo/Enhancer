from __future__ import annotations

from app.domain.planning.service import PLANNING_MODEL_PROFILE, PlanningService
from app.domain.runs.types import RunPlan


def test_planning_infers_company_outputs_from_task():
    service = PlanningService()
    output_fields = service._infer_output_fields("Research website, company size, industry, and summary.")  # noqa: SLF001

    assert [field.name for field in output_fields] == [
        "Website",
        "Company Size",
        "Industry",
        "Summary",
    ]


def test_feedback_can_remove_existing_output_field():
    service = PlanningService()
    base_fields = service._infer_output_fields("Research website, company size, industry, and summary.")  # noqa: SLF001

    updated_fields, changes = service._apply_feedback_to_output_fields(  # noqa: SLF001
        base_fields,
        "I changed my mind, I don't need company size.",
    )

    assert [field.name for field in updated_fields] == [
        "Website",
        "Industry",
        "Summary",
    ]
    assert any("Company Size" in change for change in changes)


def test_available_output_fields_include_custom_ai_defined_fields():
    service = PlanningService()
    plan = RunPlan.model_validate(
        {
            "execution_mode": "declarative",
            "sheet_name": "Companies",
            "task": "Research company details",
            "input_columns": ["Company Name"],
            "output_fields": [
                {
                    "name": "Phone Number",
                    "description": "Main public company phone number.",
                    "required": True,
                    "field_type": "string",
                }
            ],
            "prompt_template": "Prompt",
            "stricter_prompt_template": "Strict prompt",
            "model_profile": "best-quality",
            "model_id": None,
            "sample_row_indices": [0],
            "notes": [],
        }
    )

    available_fields = service.get_available_output_fields(plan)

    assert any(field.name == "Phone Number" for field in available_fields)


def test_planning_uses_balanced_profile_for_fast_chat_adaptation():
    assert PLANNING_MODEL_PROFILE == "balanced"


def test_planning_blueprint_schema_is_closed_for_structured_outputs():
    service = PlanningService()

    schema = service._planning_blueprint_schema()  # noqa: SLF001

    assert schema["additionalProperties"] is False
    assert schema["properties"]["output_fields"]["items"]["additionalProperties"] is False
    assert schema["properties"]["output_fields"]["items"]["required"] == [
        "name",
        "description",
        "required",
        "field_type",
    ]
