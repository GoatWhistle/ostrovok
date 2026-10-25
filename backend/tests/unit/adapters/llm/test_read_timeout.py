from pathlib import Path

import httpx

from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.log import LogValue


class RecordingLogger:
    def info(self, event: str, **fields: LogValue) -> None:
        return None

    def warning(self, event: str, **fields: LogValue) -> None:
        return None

    def error(self, event: str, *, exc: BaseException | None = None, **fields: LogValue) -> None:
        return None


async def test_a_read_timeout_is_retried_before_failing(characteristics_dir: Path) -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ReadTimeout("provider stalled", request=request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "hotel by the sea"}}]})

    llm = OpenAICompatLLM(
        registry=YamlCharacteristicRegistry.from_directory(characteristics_dir),
        logger=RecordingLogger(),
        base_url="https://example.com/v1",
        api_key="test",
        model="test",
        timeout_s=30,
        transport=httpx.MockTransport(handle),
    )

    assert await llm.contextualize_query("hotel", "by the sea") == "hotel by the sea"
    assert calls == 2
