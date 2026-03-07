from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import BaseModel

from app.core.config import get_settings
from app.domain.provider.capabilities import resolve_profile
from app.domain.runs.types import ModelProfile, ResearchEvidenceRecord


class OpenRouterError(RuntimeError):
    pass


class StructuredResearchResponse(BaseModel):
    outputs: dict[str, Any]
    summary: str
    confidence: float
    citations: list[ResearchEvidenceRecord]
    raw_response: dict[str, Any]


class OpenRouterClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def resolve_model(
        self,
        *,
        requested_profile: str | None,
        requested_model_id: str | None,
        require_web_research: bool,
    ) -> tuple[ModelProfile, bool]:
        profile = resolve_profile(requested_profile or self.settings.default_model_profile)
        model_overridden = False
        if requested_model_id:
            profile = profile.model_copy(update={"model_id": requested_model_id, "display_name": requested_model_id})
        if require_web_research and not profile.supports_web_research:
            profile = resolve_profile("research-heavy")
            model_overridden = True
        return profile, model_overridden

    def research_structured(
        self,
        *,
        api_key: str,
        model: ModelProfile,
        system_prompt: str,
        user_prompt: str,
        json_schema: dict[str, Any],
    ) -> StructuredResearchResponse:
        payload = {
            "model": model.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "enhancement_result", "schema": json_schema},
            },
            "plugins": [{"id": "web"}],
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": self.settings.openrouter_site_url,
            "X-Title": self.settings.openrouter_app_name,
        }
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.post(
                f"{self.settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
        if response.status_code >= 400:
            raise OpenRouterError(f"OpenRouter request failed: {response.status_code} {response.text}")
        raw = response.json()
        message = raw["choices"][0]["message"]
        content = message.get("content", "{}")
        if isinstance(content, list):
            content = "".join(chunk.get("text", "") for chunk in content if isinstance(chunk, dict))
        outputs = self._parse_json(content)
        citations = self._parse_citations(message=message, raw_response=raw)
        summary = str(outputs.get("summary", ""))
        confidence = float(outputs.get("confidence", 0.5))
        return StructuredResearchResponse(
            outputs=outputs,
            summary=summary,
            confidence=confidence,
            citations=citations,
            raw_response=raw,
        )

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any]:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.split("\n", 1)[-1]
        return json.loads(cleaned)

    @staticmethod
    def _parse_citations(message: dict[str, Any], raw_response: dict[str, Any]) -> list[ResearchEvidenceRecord]:
        annotations = OpenRouterClient._collect_citation_candidates([message, raw_response])
        citations: list[ResearchEvidenceRecord] = []
        for index, annotation in enumerate(annotations):
            source_url = str(annotation.get("url") or annotation.get("source_url") or "").strip()
            if not source_url:
                continue
            citations.append(
                ResearchEvidenceRecord(
                    row_index=0,
                    source_url=source_url,
                    title=annotation.get("title") or annotation.get("name"),
                    snippet=annotation.get("snippet") or annotation.get("text") or annotation.get("summary"),
                    citation_metadata=annotation,
                    confidence_contribution=0.5,
                )
            )
        return citations

    @staticmethod
    def _collect_citation_candidates(objects: list[Any]) -> list[dict[str, Any]]:
        collected: list[dict[str, Any]] = []
        seen: set[tuple[str, str | None, str | None]] = set()

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                url = value.get("url") or value.get("source_url")
                title = value.get("title") or value.get("name")
                snippet = value.get("snippet") or value.get("text") or value.get("summary")
                if url:
                    key = (str(url), title, snippet)
                    if key not in seen:
                        seen.add(key)
                        collected.append(value)
                for key_name, nested in value.items():
                    if key_name in {"annotations", "citations", "sources", "results", "search_results", "references"}:
                        visit(nested)
                    elif isinstance(nested, (dict, list)):
                        visit(nested)
                return
            if isinstance(value, list):
                for item in value:
                    visit(item)

        for item in objects:
            visit(item)
        return collected
