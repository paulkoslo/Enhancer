from __future__ import annotations

from app.domain.planning.service import PlanningService


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
