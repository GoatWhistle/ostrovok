from dataclasses import dataclass

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.hotel_catalog import PostgresHotelCatalog
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.external.etg_offers import EtgHotelOffers
from hotel_agent.adapters.external.nuitee_catalog import NuiteeCatalog
from hotel_agent.adapters.external.nuitee_discovery import NuiteeDiscovery
from hotel_agent.adapters.external.nuitee_offers import NuiteeHotelOffers
from hotel_agent.adapters.external.ostrovok_offers import OstrovokHotelOffers
from hotel_agent.adapters.external.wikidata_places import WikidataPlaceLookup
from hotel_agent.adapters.llm.anthropic import AnthropicLLM
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import HotelOfferSearchPort, HotelOffersPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.match_hotel_catalog import MatchHotelCatalog
from hotel_agent.settings import ConfigError, HotelDataMode, LLMProvider, Settings


@dataclass(frozen=True, slots=True)
class Providers:
    registry: CharacteristicRegistryPort
    llm: LLMPort
    clock: ClockPort
    logger: LoggerPort
    uow: PostgresUnitOfWorkFactory
    hotel_offers: HotelOffersPort | None
    place_lookup: PlaceLookupPort
    catalog_matcher: MatchHotelCatalog | None = None
    hotel_offer_search: HotelOfferSearchPort | None = None

    async def aclose(self) -> None:
        if self.hotel_offer_search is not None:
            await self.hotel_offer_search.aclose()
        await self.llm.aclose()
        await self.uow.aclose()
        await self.place_lookup.aclose()


def build_providers(settings: Settings, logger: LoggerPort) -> Providers:
    registry = YamlCharacteristicRegistry.from_directory(settings.characteristics_dir)
    uow = PostgresUnitOfWorkFactory(settings.database_url, settings.seed_dir)
    clock = SystemClock()
    matcher = (
        MatchHotelCatalog(
            uow,
            NuiteeDiscovery(settings.nuitee_api_key),
            NuiteeCatalog(settings.nuitee_api_key),
            PostgresHotelCatalog(uow.pool),
        )
        if settings.hotel_data_mode is HotelDataMode.PARTNER and settings.nuitee_api_key
        else None
    )
    return Providers(
        registry=registry,
        llm=build_llm(settings, registry, logger),
        clock=clock,
        logger=logger,
        uow=uow,
        hotel_offers=build_hotel_offers(settings),
        place_lookup=WikidataPlaceLookup(),
        catalog_matcher=matcher,
        hotel_offer_search=OstrovokHotelOffers(clock)
        if settings.hotel_data_mode is HotelDataMode.FREE and settings.ostrovok_site_enabled
        else None,
    )


def build_llm(
    settings: Settings, registry: CharacteristicRegistryPort, logger: LoggerPort
) -> LLMPort:
    match settings.llm_provider:
        case LLMProvider.FAKE:
            return FakeLLM(registry)
        case LLMProvider.OPENAI_COMPAT:
            return OpenAICompatLLM(
                registry=registry,
                logger=logger,
                base_url=_required(settings, settings.llm_base_url, "LLM_BASE_URL"),
                api_key=_required(settings, settings.llm_api_key, "LLM_API_KEY"),
                model=_required(settings, settings.llm_model, "LLM_MODEL"),
                fallback_model=settings.llm_fallback_model,
                timeout_s=settings.llm_timeout_s,
            )
        case LLMProvider.ANTHROPIC:
            return AnthropicLLM(
                registry=registry,
                logger=logger,
                base_url=settings.llm_base_url or "https://api.anthropic.com/v1",
                api_key=_required(settings, settings.llm_api_key, "LLM_API_KEY"),
                model=_required(settings, settings.llm_model, "LLM_MODEL"),
                fallback_model=settings.llm_fallback_model,
                timeout_s=settings.llm_timeout_s,
            )


def _required(settings: Settings, value: str | None, name: str) -> str:
    if not value:
        raise ConfigError(f"LLM_PROVIDER={settings.llm_provider} needs {name}")
    return value


def build_hotel_offers(settings: Settings) -> HotelOffersPort | None:
    if settings.hotel_data_mode is HotelDataMode.FREE:
        return None
    if settings.nuitee_api_key:
        return NuiteeHotelOffers(settings.nuitee_api_key)
    if settings.etg_key_id and settings.etg_api_key:
        return EtgHotelOffers(settings.etg_key_id, settings.etg_api_key, settings.etg_environment)
    return None
