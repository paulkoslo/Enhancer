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
