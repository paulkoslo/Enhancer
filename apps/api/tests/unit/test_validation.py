from __future__ import annotations

from app.domain.runs.types import OutputFieldDefinition, ValidationState
from app.domain.validation.service import ValidationService


def test_validation_retries_when_website_is_directory_without_citations():
    service = ValidationService()
    normalized, state, warnings, confidence = service.validate_outputs(
        outputs={
            "Website": "linkedin.com/company/acme",
            "Summary": "Acme makes widgets.",
            "confidence": 0.8,
        },
        output_fields=[
            OutputFieldDefinition(name="Website", description="Official URL"),
            OutputFieldDefinition(name="Summary", description="Short summary"),
        ],
        has_citations=False,
    )

    assert state == ValidationState.RETRYABLE
    assert "Website" in normalized
    assert warnings
    assert confidence <= 0.35


def test_validation_soft_passes_missing_citations_with_partial_outputs():
    service = ValidationService()
    normalized, state, warnings, confidence = service.validate_outputs(
        outputs={
            "Website": "example.com",
            "Summary": "Acme makes widgets.",
            "confidence": 0.8,
        },
        output_fields=[
            OutputFieldDefinition(name="Website", description="Official URL"),
            OutputFieldDefinition(name="Summary", description="Short summary"),
        ],
        has_citations=False,
    )

    assert state == ValidationState.NEEDS_REVIEW
    assert normalized["Website"] == "https://example.com"
    assert any("No citations" in warning for warning in warnings)
    assert confidence <= 0.45
