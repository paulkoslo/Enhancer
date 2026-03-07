from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from app.domain.runs.types import OutputFieldDefinition, ValidationState


DISALLOWED_WEBSITE_DOMAINS = {
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "wikipedia.org",
    "crunchbase.com",
}


class ValidationService:
    def validate_outputs(
        self,
        *,
        outputs: dict[str, Any],
        output_fields: list[OutputFieldDefinition],
        has_citations: bool,
    ) -> tuple[dict[str, Any], ValidationState, list[str], float]:
        warnings: list[str] = []
        confidence = float(outputs.get("confidence", 0.5))
        normalized = {field.name: str(outputs.get(field.name, "") or "").strip() for field in output_fields}
        missing_required = 0

        for field in output_fields:
            if field.required and not normalized[field.name]:
                warnings.append(f"{field.name} is missing.")
                missing_required += 1

            if field.name.lower() in {"website", "url"} and normalized[field.name]:
                valid, website_warning, normalized_url = self._validate_website(normalized[field.name])
                normalized[field.name] = normalized_url
                if website_warning:
                    warnings.append(website_warning)
                if not valid:
                    return normalized, ValidationState.RETRYABLE, warnings, min(confidence, 0.3)

            if field.name.lower() == "summary" and len(normalized[field.name]) > 320:
                normalized[field.name] = normalized[field.name][:317].rstrip() + "..."
                warnings.append("Summary truncated to 320 characters.")

        if not any(normalized.values()):
            warnings.append("The research step returned no usable values.")
            return normalized, ValidationState.RETRYABLE, warnings, min(confidence, 0.2)

        if not has_citations:
            warnings.append("No citations were returned by the research step.")
            confidence = min(confidence, 0.45)

        if missing_required == len(output_fields):
            return normalized, ValidationState.RETRYABLE, warnings, min(confidence, 0.3)

        if warnings:
            return normalized, ValidationState.NEEDS_REVIEW, warnings, confidence
        return normalized, ValidationState.VALID, warnings, confidence

    def _validate_website(self, value: str) -> tuple[bool, str | None, str]:
        normalized = value
        if not normalized.startswith("http"):
            normalized = f"https://{normalized}"
        parsed = urlparse(normalized)
        if not parsed.netloc or "." not in parsed.netloc:
            return False, "Website does not look like a valid domain.", normalized
        domain = parsed.netloc.lower().removeprefix("www.")
        if any(domain.endswith(disallowed) for disallowed in DISALLOWED_WEBSITE_DOMAINS):
            return False, "Website resolved to a directory or social domain.", normalized
        return True, None, normalized
