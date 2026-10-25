from dataclasses import dataclass

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.external.etg_offers import EtgHotelOffers
from hotel_agent.adapters.external.nuitee_offers import NuiteeHotelOffers
from hotel_agent.adapters.external.wikidata_places import WikidataPlaceLookup
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import HotelOffersPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.settings import ConfigError, LLMProvider, Settings


@dataclass(frozen=True, slots=True)
class Providers:
    registry: CharacteristicRegistryPort
    llm: LLMPort
    clock: ClockPort
    logger: LoggerPort
    uow: PostgresUnitOfWorkFactory
    hotel_offers: HotelOffersPort | None
    place_lookup: PlaceLookupPort

    async def aclose(self) -> None:
        await self.llm.aclose()
        await self.uow.aclose()
        await self.place_lookup.aclose()


def build_providers(settings: Settings, logger: LoggerPort) -> Providers:
    registry = YamlCharacteristicRegistry.from_directory(settings.characteristics_dir)
    return Providers(
        registry=registry,
        llm=build_llm(settings, registry, logger),
        clock=SystemClock(),
        logger=logger,
        uow=PostgresUnitOfWorkFactory(settings.database_url),
        hotel_offers=build_hotel_offers(settings),
        place_lookup=WikidataPlaceLookup(),
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
                base_url=_required(settings.llm_base_url, "LLM_BASE_URL"),
                api_key=_required(settings.llm_api_key, "LLM_API_KEY"),
                model=_required(settings.llm_model, "LLM_MODEL"),
                fallback_model=settings.llm_fallback_model,
                timeout_s=settings.llm_timeout_s,
            )
        case LLMProvider.ANTHROPIC:
            raise ConfigError(
                "LLM_PROVIDER=anthropic is not implemented yet; use fake or openai_compat"
            )


def _required(value: str | None, name: str) -> str:
    if not value:
        raise ConfigError(f"LLM_PROVIDER=openai_compat needs {name}")
    return value


def build_hotel_offers(settings: Settings) -> HotelOffersPort | None:
    if settings.nuitee_api_key:
        return NuiteeHotelOffers(settings.nuitee_api_key)
    if settings.etg_key_id and settings.etg_api_key:
        return EtgHotelOffers(settings.etg_key_id, settings.etg_api_key, settings.etg_environment)
    return None
