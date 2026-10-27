import httpx

from hotel_agent.adapters.llm.anthropic_completion import AnthropicCompletion
from hotel_agent.adapters.llm.response_cache import CachedCompletion
from hotel_agent.adapters.llm.structured import StructuredLLM
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort


class AnthropicLLM(StructuredLLM):
    def __init__(
        self,
        *,
        registry: CharacteristicRegistryPort,
        logger: LoggerPort,
        api_key: str,
        model: str,
        timeout_s: float,
        base_url: str = "https://api.anthropic.com/v1",
        fallback_model: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        super().__init__(
            registry=registry,
            logger=logger,
            completion=CachedCompletion(
                AnthropicCompletion(
                    logger=logger,
                    api_key=api_key,
                    model=model,
                    timeout_s=timeout_s,
                    base_url=base_url,
                    fallback_model=fallback_model,
                    transport=transport,
                ),
                logger,
            ),
        )
