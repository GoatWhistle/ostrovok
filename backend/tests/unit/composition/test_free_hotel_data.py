from dataclasses import replace

import pytest

from hotel_agent.adapters.external.ostrovok_offers import OstrovokHotelOffers
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.cli import main
from hotel_agent.composition import build_providers
from hotel_agent.settings import ConfigError, HotelDataMode, LLMProvider, Settings, load_settings

from .test_main import SilentLogger


async def test_keys_alone_do_not_enable_commercial_hotel_apis(settings: Settings) -> None:
    providers = build_providers(
        replace(settings, nuitee_api_key="test-key", etg_key_id="test-id", etg_api_key="test-key"),
        SilentLogger(),
    )
    try:
        assert providers.hotel_offers is None
        assert isinstance(providers.hotel_offer_search, OstrovokHotelOffers)
        assert providers.catalog_matcher is None
        assert isinstance(providers.llm, FakeLLM)
    finally:
        await providers.aclose()


async def test_free_website_search_can_be_disabled_without_enabling_paid_providers(
    settings: Settings,
) -> None:
    providers = build_providers(replace(settings, ostrovok_site_enabled=False), SilentLogger())
    try:
        assert providers.hotel_offers is None
        assert providers.hotel_offer_search is None
        assert providers.catalog_matcher is None
    finally:
        await providers.aclose()
    assert not load_settings({"OSTROVOK_SITE": "off"}).ostrovok_site_enabled
    with pytest.raises(ConfigError, match="OSTROVOK_SITE"):
        load_settings({"OSTROVOK_SITE": "invalid"})


async def test_partner_data_requires_an_explicit_mode(settings: Settings) -> None:
    providers = build_providers(
        replace(settings, hotel_data_mode=HotelDataMode.PARTNER, nuitee_api_key="test-key"),
        SilentLogger(),
    )
    try:
        assert providers.hotel_offers is not None
        assert providers.catalog_matcher is not None
    finally:
        await providers.aclose()


def test_hotel_data_mode_defaults_to_free_without_changing_the_llm_selection() -> None:
    settings = load_settings(
        {"LLM_PROVIDER": "anthropic", "LLM_API_KEY": "test-key", "LLM_MODEL": "claude-sonnet-4-6"}
    )
    assert settings.hotel_data_mode is HotelDataMode.FREE
    assert settings.llm_provider is LLMProvider.ANTHROPIC
    with pytest.raises(ConfigError, match="HOTEL_DATA_MODE"):
        load_settings({"HOTEL_DATA_MODE": "unlimited"})


@pytest.mark.parametrize(
    "arguments",
    [
        ["match-nuitee", "--hotel-id", "local-1"],
        ["match-nuitee", "--hotel-id", "local-1", "--apply"],
        ["sync-nuitee", "--hotel-id", "local-1", "--supplier-id", "supplier-1"],
    ],
)
def test_manual_catalog_commands_are_blocked_in_free_mode(
    monkeypatch: pytest.MonkeyPatch,
    arguments: list[str],
) -> None:
    monkeypatch.setenv("HOTEL_DATA_MODE", "free")
    monkeypatch.setenv("NUITEE_API_KEY", "test-key")
    with pytest.raises(SystemExit, match="HOTEL_DATA_MODE=free disables"):
        main(arguments)
