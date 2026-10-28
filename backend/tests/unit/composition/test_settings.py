from pathlib import Path
from unittest.mock import MagicMock

import pytest

from hotel_agent.composition import build_review_llm
from hotel_agent.settings import (
    DEFAULT_DATABASE_URL,
    ConfigError,
    LLMProvider,
    Settings,
    load_settings,
)


def test_empty_environment_selects_the_offline_provider() -> None:
    assert load_settings({}) == Settings()
    assert Settings().llm_provider is LLMProvider.FAKE
    assert Settings().database_url == DEFAULT_DATABASE_URL


def test_environment_selects_a_paid_provider() -> None:
    settings = load_settings(
        {
            "LLM_PROVIDER": "openai_compat",
            "LLM_API_KEY": "secret",
            "LLM_BASE_URL": "http://vllm:8000/v1",
            "LLM_MODEL": "qwen",
            "LLM_FALLBACK_MODEL": "yandexgpt-lite",
            "LLM_TIMEOUT_S": "2.5",
            "CHARACTERISTICS_DIR": "/srv/characteristics",
            "SEED_DIR": "/srv/data/seed",
            "DATABASE_URL": "postgresql://u:p@db:5432/hotel",
        }
    )

    assert settings == Settings(
        llm_provider=LLMProvider.OPENAI_COMPAT,
        llm_api_key="secret",
        llm_base_url="http://vllm:8000/v1",
        llm_model="qwen",
        llm_fallback_model="yandexgpt-lite",
        llm_timeout_s=2.5,
        characteristics_dir=Path("/srv/characteristics"),
        seed_dir=Path("/srv/data/seed"),
        database_url="postgresql://u:p@db:5432/hotel",
    )


def test_blank_values_fall_back_to_defaults() -> None:
    settings = load_settings({"LLM_API_KEY": "", "CHARACTERISTICS_DIR": "", "DATABASE_URL": ""})

    assert settings.llm_api_key is None
    assert settings.characteristics_dir == Path("characteristics")
    assert settings.database_url == DEFAULT_DATABASE_URL


@pytest.mark.parametrize(
    ("env", "message"),
    [
        ({"LLM_PROVIDER": "gpt"}, "LLM_PROVIDER='gpt' is not supported; use one of: fake"),
        ({"LLM_TIMEOUT_S": "soon"}, "LLM_TIMEOUT_S='soon' is not a number"),
        ({"LLM_TIMEOUT_S": "0"}, "LLM_TIMEOUT_S='0' must be positive"),
    ],
)
def test_invalid_value_names_the_variable(env: dict[str, str], message: str) -> None:
    with pytest.raises(ConfigError, match=message):
        load_settings(env)


def test_review_model_defaults_to_the_planning_model() -> None:
    assert load_settings({"LLM_PLANNING_MODEL": "fast"}).llm_review_model == "fast"
    chosen = load_settings({"LLM_PLANNING_MODEL": "fast", "LLM_REVIEW_MODEL": "review"})
    assert chosen.llm_review_model == "review"


def test_review_model_equal_to_the_main_model_adds_no_second_client() -> None:
    settings = Settings(
        llm_provider=LLMProvider.OPENAI_COMPAT,
        llm_api_key="key",
        llm_base_url="https://example.invalid/v1",
        llm_model="main",
        llm_review_model="main",
    )
    assert build_review_llm(settings, MagicMock(), MagicMock()) is None
    assert build_review_llm(Settings(llm_review_model="fast"), MagicMock(), MagicMock()) is None
