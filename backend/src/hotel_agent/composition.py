from dataclasses import dataclass

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.settings import ConfigError, LLMProvider, Settings


@dataclass(frozen=True, slots=True)
class Providers:
    registry: CharacteristicRegistryPort
    llm: LLMPort
    clock: ClockPort
    logger: LoggerPort

    async def aclose(self) -> None:
        await self.llm.aclose()


def build_providers(settings: Settings, logger: LoggerPort) -> Providers:
    registry = YamlCharacteristicRegistry.from_directory(settings.characteristics_dir)
    return Providers(
        registry=registry,
        llm=build_llm(settings, registry),
        clock=SystemClock(),
        logger=logger,
    )


def build_llm(settings: Settings, registry: CharacteristicRegistryPort) -> LLMPort:
    match settings.llm_provider:
        case LLMProvider.FAKE:
            return FakeLLM(registry)
        case LLMProvider.ANTHROPIC | LLMProvider.OPENAI_COMPAT:
            raise ConfigError(
                f"LLM_PROVIDER={settings.llm_provider.value} is not implemented yet; use fake"
            )
