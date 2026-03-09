from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient
import pandas as pd

def _mock_research_response():
    from app.domain.provider.openrouter import StructuredResearchResponse
    from app.domain.runs.types import ResearchEvidenceRecord

    return StructuredResearchResponse(
        outputs={
            "Website": "https://example.com",
            "Company Size": "50-200 employees",
            "Industry": "Industrial software",
            "Summary": "Example Corp builds industrial software for factory operations.",
            "confidence": 0.88,
        },
        summary="Example Corp builds industrial software for factory operations.",
        confidence=0.88,
        citations=[
            ResearchEvidenceRecord(
                row_index=0,
                source_url="https://example.com/about",
                title="About Example Corp",
                snippet="Industrial software for factory operations.",
            )
        ],
        raw_response={"mock": True},
    )


def _mock_research_without_citations():
    from app.domain.provider.openrouter import StructuredResearchResponse

    return StructuredResearchResponse(
        outputs={
            "Website": "https://example.com",
            "Industry": "Industrial software",
            "Summary": "Example Corp builds industrial software for factory operations.",
            "confidence": 0.72,
        },
        summary="Example Corp builds industrial software for factory operations.",
        confidence=0.72,
        citations=[],
        raw_response={"mock": True},
    )


def _mock_generate_ai_blueprint(self, session, **kwargs):
    from app.domain.planning.service import PlanningBlueprint
    from app.domain.runs.types import OutputFieldDefinition

    locked_output_fields = kwargs.get("locked_output_fields")
    feedback_history = kwargs.get("feedback_history", [])
    latest_feedback = " ".join(feedback_history).lower()
    if locked_output_fields:
        output_fields = [field.model_copy(deep=True) for field in locked_output_fields]
    elif "phone" in latest_feedback:
        output_fields = [
            OutputFieldDefinition(name="Website", description="Official company website"),
            OutputFieldDefinition(name="Industry", description="Primary industry"),
            OutputFieldDefinition(name="Phone Number", description="Main public company phone number"),
        ]
    else:
        output_fields = [
            OutputFieldDefinition(name="Website", description="Official company website"),
            OutputFieldDefinition(name="Company Size", description="Approximate company size"),
            OutputFieldDefinition(name="Industry", description="Primary industry"),
            OutputFieldDefinition(name="Summary", description="Short company summary"),
        ]
    field_names = ", ".join(field.name for field in output_fields)
    return PlanningBlueprint(
        output_fields=output_fields,
        prompt_template=f"Research the row and return: {field_names}. Include confidence.",
        stricter_prompt_template=f"Be strict. Return only verified values for: {field_names}. Include confidence.",
        assistant_response=f"Updated the plan to focus on: {field_names}.",
    )


def test_upload_plan_dry_run_execute_flow(monkeypatch):
    from app.domain.execution.service import ExecutionService
    from app.main import app

    execution = ExecutionService()
    monkeypatch.setattr(execution.dispatcher, "dispatch", lambda fn, *args: fn(*args))
    from app.api.routes import runs

    runs.execution.dispatcher = execution.dispatcher
    monkeypatch.setattr(
        "app.domain.provider.openrouter.OpenRouterClient.research_structured",
        lambda self, **kwargs: _mock_research_response(),
    )
    monkeypatch.setattr(
        "app.domain.planning.service.PlanningService._generate_ai_blueprint",
        _mock_generate_ai_blueprint,
    )

    csv_buffer = BytesIO()
    pd.DataFrame(
        [
            {"Company Name": "Example Corp", "City": "Berlin", "Country": "DE"},
            {"Company Name": "Sample Ltd", "City": "Munich", "Country": "DE"},
        ]
    ).to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    with TestClient(app) as client:
        upload_response = client.post(
            "/api/files",
            files={"upload": ("companies.csv", csv_buffer.getvalue(), "text/csv")},
        )
        assert upload_response.status_code == 200
        file_id = upload_response.json()["id"]

        settings_response = client.post(
            "/api/settings/openrouter",
            json={"api_key": "test-key", "default_model_profile": "best-quality"},
        )
        assert settings_response.status_code == 200

        create_run_response = client.post(
            "/api/runs",
            json={
                "file_id": file_id,
                "task": "Research company website, company size, industry, and summary.",
                "sheet_name": "Data",
                "requested_model_profile": "best-quality",
            },
        )
        assert create_run_response.status_code == 200
        run_id = create_run_response.json()["id"]

        patch_plan_response = client.patch(
            f"/api/runs/{run_id}/plan/draft",
            json={"enabled_output_fields": ["Website", "Industry", "Summary"]},
        )
        assert patch_plan_response.status_code == 200
        assert [field["name"] for field in patch_plan_response.json()["draft_plan"]["output_fields"]] == [
            "Website",
            "Industry",
            "Summary",
        ]

        message_response = client.post(
            f"/api/runs/{run_id}/messages",
            json={"content": "I don't want summaries, I want a phone number."},
        )
        assert message_response.status_code == 200
        assert message_response.json()["messages"][-1]["role"] == "assistant"
        assert message_response.json()["messages"][-1]["content"] == "Updated the plan to focus on: Website, Industry, Phone Number."
        assert [field["name"] for field in message_response.json()["draft_plan"]["output_fields"]] == [
            "Website",
            "Industry",
            "Phone Number",
        ]
        assert message_response.json()["task"] == "Research company website, company size, industry, and summary."
        assert "Accepted refinements" not in message_response.json()["draft_plan"]["prompt_template"]

        assert client.post(f"/api/runs/{run_id}/plan/approve").status_code == 200
        dry_run_response = client.post(f"/api/runs/{run_id}/dry-run")
        assert dry_run_response.status_code == 200

        dry_run_download_response = client.get(f"/api/runs/{run_id}/dry-run/download")
        assert dry_run_download_response.status_code == 200
        assert dry_run_download_response.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        approve_dry_run_response = client.post(f"/api/runs/{run_id}/dry-run/approve")
        assert approve_dry_run_response.status_code == 200

        execute_response = client.post(f"/api/runs/{run_id}/execute")
        assert execute_response.status_code == 200

        run_response = client.get(f"/api/runs/{run_id}")
        assert run_response.status_code == 200
        payload = run_response.json()
        assert payload["status"] == "completed"
        assert any(result["output_json"]["Website"] == "https://example.com" for result in payload["row_results"])
        assert any(event["type"] == "agent" for event in payload["latest_events"])

        download_response = client.get(f"/api/runs/{run_id}/download")
        assert download_response.status_code == 200
        assert download_response.headers["content-disposition"].endswith('filename="companies-enhanced.xlsx"')

        delete_key_response = client.delete("/api/settings/openrouter")
        assert delete_key_response.status_code == 200
        assert delete_key_response.json()["configured"] is False


def test_dry_run_soft_passes_when_citations_are_missing(monkeypatch):
    from app.domain.execution.service import ExecutionService
    from app.main import app

    execution = ExecutionService()
    monkeypatch.setattr(execution.dispatcher, "dispatch", lambda fn, *args: fn(*args))
    from app.api.routes import runs

    runs.execution.dispatcher = execution.dispatcher
    monkeypatch.setattr(
        "app.domain.provider.openrouter.OpenRouterClient.research_structured",
        lambda self, **kwargs: _mock_research_without_citations(),
    )
    monkeypatch.setattr(
        "app.domain.planning.service.PlanningService._generate_ai_blueprint",
        _mock_generate_ai_blueprint,
    )

    csv_buffer = BytesIO()
    pd.DataFrame(
        [
            {"Company Name": "Example Corp", "City": "Berlin", "Country": "DE"},
        ]
    ).to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    with TestClient(app) as client:
        upload_response = client.post(
            "/api/files",
            files={"upload": ("companies.csv", csv_buffer.getvalue(), "text/csv")},
        )
        file_id = upload_response.json()["id"]
        client.post("/api/settings/openrouter", json={"api_key": "test-key", "default_model_profile": "best-quality"})
        create_run_response = client.post(
            "/api/runs",
            json={
                "file_id": file_id,
                "task": "Research company website, industry, and summary.",
                "sheet_name": "Data",
                "requested_model_profile": "best-quality",
            },
        )
        run_id = create_run_response.json()["id"]

        client.post(f"/api/runs/{run_id}/plan/approve")
        dry_run_response = client.post(f"/api/runs/{run_id}/dry-run")

        assert dry_run_response.status_code == 200
        run_payload = client.get(f"/api/runs/{run_id}").json()
        assert run_payload["status"] == "dry_run_review"
        assert run_payload["row_results"][0]["status"] == "needs_review"
        assert any("No citations" in warning for warning in run_payload["row_results"][0]["warnings"])
