from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from hotel_agent.adapters.llm.fake import FakeLLM
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


@pytest.mark.parametrize("provider", [LLMProvider.ANTHROPIC, LLMProvider.OPENAI_COMPAT])
def test_unimplemented_provider_fails_loudly(settings: Settings, provider: LLMProvider) -> None:
    with pytest.raises(ConfigError, match=f"LLM_PROVIDER={provider.value}"):
        build_providers(replace(settings, llm_provider=provider), SilentLogger())


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
