from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.composition import Providers, build_providers
from hotel_agent.domain.errors import InvalidRegistry
from hotel_agent.main import create_app
from hotel_agent.settings import ConfigError, LLMProvider, Settings


class SilentLogger:
    def info(self, event: str, **fields: object) -> None: ...

    def warning(self, event: str, **fields: object) -> None: ...

    def error(self, event: str, *, exc: BaseException | None = None, **fields: object) -> None: ...


def test_default_settings_select_offline_implementations(settings: Settings) -> None:
    providers = build_providers(settings, SilentLogger())

    assert isinstance(providers.llm, FakeLLM)
    assert isinstance(providers.registry, YamlCharacteristicRegistry)
    assert providers.llm.provider == "fake"


ENDPOINT: dict[str, str | None] = {
    "llm_base_url": "https://llm.api.cloud.yandex.net/v1",
    "llm_api_key": "secret",
    "llm_model": "gpt://folder/yandexgpt-5.1/latest",
}


def configured(settings: Settings, without: str | None = None) -> Settings:
    values = {**ENDPOINT, without: None} if without else ENDPOINT
    return replace(
        settings,
        llm_provider=LLMProvider.OPENAI_COMPAT,
        llm_base_url=values["llm_base_url"],
        llm_api_key=values["llm_api_key"],
        llm_model=values["llm_model"],
    )


def test_a_configured_endpoint_selects_the_http_adapter(settings: Settings) -> None:
    providers = build_providers(configured(settings), SilentLogger())

    assert isinstance(providers.llm, OpenAICompatLLM)
    assert providers.llm.provider == "openai_compat"


@pytest.mark.parametrize("missing", ["llm_base_url", "llm_api_key", "llm_model"])
def test_an_endpoint_without_its_settings_fails_loudly(settings: Settings, missing: str) -> None:
    with pytest.raises(ConfigError, match=missing.upper()):
        build_providers(configured(settings, without=missing), SilentLogger())


def test_anthropic_is_still_unimplemented(settings: Settings) -> None:
    with pytest.raises(ConfigError, match="LLM_PROVIDER=anthropic"):
        build_providers(replace(settings, llm_provider=LLMProvider.ANTHROPIC), SilentLogger())


def test_missing_registry_fails_at_startup() -> None:
    with pytest.raises(InvalidRegistry, match="is not a directory"):
        create_app(Settings(characteristics_dir=Path("/nowhere/characteristics")))


def test_lifespan_exposes_and_closes_providers(settings: Settings) -> None:
    app = create_app(settings)

    with TestClient(app):
        providers = app.state.providers
        assert isinstance(providers, Providers)

    assert app.state.providers is providers


def test_characteristics_directory_comes_from_the_environment(
    monkeypatch: pytest.MonkeyPatch, characteristics_dir: Path
) -> None:
    monkeypatch.setenv("CHARACTERISTICS_DIR", str(characteristics_dir))

    with TestClient(create_app()) as client:
        assert client.get("/api/v1/health").json()["llm_provider"] == "fake"
