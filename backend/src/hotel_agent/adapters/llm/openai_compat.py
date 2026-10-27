import httpx

from hotel_agent.adapters.llm.openai_completion import OpenAICompletion
from hotel_agent.adapters.llm.response_cache import CachedCompletion
from hotel_agent.adapters.llm.structured import StructuredLLM
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort


class OpenAICompatLLM(StructuredLLM):
    def __init__(
        self,
        *,
        registry: CharacteristicRegistryPort,
        logger: LoggerPort,
        base_url: str,
        api_key: str,
        model: str,
        fallback_model: str | None = None,
        planning_model: str | None = None,
        timeout_s: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        super().__init__(
            registry=registry,
            logger=logger,
            completion=CachedCompletion(
                OpenAICompletion(
                    logger=logger,
                    base_url=base_url,
                    api_key=api_key,
                    model=model,
                    fallback_model=fallback_model,
                    planning_model=planning_model,
                    timeout_s=timeout_s,
                    transport=transport,
                ),
                logger,
            ),
        )
