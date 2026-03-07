from __future__ import annotations

from app.domain.runs.types import ModelProfile


MODEL_PROFILES: dict[str, ModelProfile] = {
    "best-quality": ModelProfile(
        profile_id="best-quality",
        provider="openrouter",
        model_id="openai/gpt-5.4",
        display_name="OpenAI GPT-5.4",
        supports_web_research=True,
        supports_structured_output=True,
        cost_tier="premium",
        latency_tier="medium",
        recommended_concurrency=3,
    ),
    "balanced": ModelProfile(
        profile_id="balanced",
        provider="openrouter",
        model_id="openai/gpt-5.4-mini",
        display_name="OpenAI GPT-5.4 Mini",
        supports_web_research=True,
        supports_structured_output=True,
        cost_tier="medium",
        latency_tier="medium",
        recommended_concurrency=5,
    ),
    "research-heavy": ModelProfile(
        profile_id="research-heavy",
        provider="openrouter",
        model_id="openai/gpt-5.4",
        display_name="OpenAI GPT-5.4 Research",
        supports_web_research=True,
        supports_structured_output=True,
        cost_tier="premium",
        latency_tier="medium",
        recommended_concurrency=2,
    ),
    "coding-heavy": ModelProfile(
        profile_id="coding-heavy",
        provider="openrouter",
        model_id="openai/gpt-5.4",
        display_name="OpenAI GPT-5.4 Coding",
        supports_web_research=True,
        supports_structured_output=True,
        cost_tier="premium",
        latency_tier="medium",
        recommended_concurrency=2,
    ),
}


def resolve_profile(profile_id: str | None) -> ModelProfile:
    if profile_id and profile_id in MODEL_PROFILES:
        return MODEL_PROFILES[profile_id]
    return MODEL_PROFILES["best-quality"]


def list_profiles() -> list[ModelProfile]:
    return list(MODEL_PROFILES.values())
