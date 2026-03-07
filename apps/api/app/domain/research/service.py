from __future__ import annotations

from typing import Any

from app.domain.provider.openrouter import OpenRouterClient, StructuredResearchResponse
from app.domain.runs.types import ModelProfile, OutputFieldDefinition, ResearchEvidenceRecord, RunPlan


class ResearchService:
    def __init__(self) -> None:
        self.provider = OpenRouterClient()

    def build_schema(self, output_fields: list[OutputFieldDefinition]) -> dict[str, Any]:
        properties: dict[str, Any] = {
            field.name: {"type": "string", "description": field.description} for field in output_fields
        }
        properties["confidence"] = {
            "type": "number",
            "description": "Confidence between 0 and 1.",
        }
        return {
            "type": "object",
            "properties": properties,
            "required": [field.name for field in output_fields] + ["confidence"],
            "additionalProperties": False,
        }

    def enrich_row(
        self,
        *,
        api_key: str,
        plan: RunPlan,
        row_index: int,
        row_data: dict[str, Any],
        model: ModelProfile,
        stricter: bool = False,
    ) -> tuple[dict[str, Any], list[ResearchEvidenceRecord], dict[str, Any]]:
        prompt = plan.stricter_prompt_template if stricter else plan.prompt_template
        row_context = "\n".join(f"{key}: {value}" for key, value in row_data.items() if str(value).strip())
        user_prompt = (
            f"{prompt}\n\n"
            "Row context:\n"
            f"{row_context}\n\n"
            "Return only structured JSON matching the required schema."
        )
        response: StructuredResearchResponse = self.provider.research_structured(
            api_key=api_key,
            model=model,
            system_prompt="You are a careful company research agent.",
            user_prompt=user_prompt,
            json_schema=self.build_schema(plan.output_fields),
        )
        citations = [
            citation.model_copy(update={"row_index": row_index}) for citation in response.citations
        ]
        return response.outputs, citations, response.raw_response
