from __future__ import annotations

from app.domain.provider.openrouter import OpenRouterClient
from app.domain.research.service import ResearchService
from app.domain.runs.types import OutputFieldDefinition


def test_research_schema_contains_fields_and_confidence():
    service = ResearchService()
    schema = service.build_schema(
        [
            OutputFieldDefinition(name="Website", description="Official website"),
            OutputFieldDefinition(name="Summary", description="Short summary"),
        ]
    )

    assert "Website" in schema["properties"]
    assert "Summary" in schema["properties"]
    assert "confidence" in schema["properties"]


def test_openrouter_parses_nested_citation_shapes():
    citations = OpenRouterClient._parse_citations(  # noqa: SLF001
        message={
            "content": [{"type": "output_text", "text": "{}"}],
            "annotations": [{"url": "https://example.com/about", "title": "About Example"}],
        },
        raw_response={
            "sources": [
                {
                    "source_url": "https://example.com/team",
                    "name": "Team",
                    "text": "Leadership overview",
                }
            ]
        },
    )

    assert [citation.source_url for citation in citations] == [
        "https://example.com/about",
        "https://example.com/team",
    ]


def test_openrouter_normalizes_object_schemas_for_strict_outputs():
    schema = OpenRouterClient._normalize_json_schema(  # noqa: SLF001
        {
            "type": "object",
            "properties": {
                "output_fields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                        },
                    },
                },
                "assistant_response": {"type": "string"},
            },
        }
    )

    assert schema["additionalProperties"] is False
    assert schema["required"] == ["output_fields", "assistant_response"]
    assert schema["properties"]["output_fields"]["items"]["additionalProperties"] is False
    assert schema["properties"]["output_fields"]["items"]["required"] == ["name", "description"]
