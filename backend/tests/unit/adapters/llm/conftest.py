import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from hotel_agent.adapters.llm.anthropic import AnthropicLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.log import LogValue

type AnthropicBuild = Callable[..., AnthropicLLM]


class RecordingLogger:
    def __init__(self) -> None:
        self.events: list[str] = []

    def info(self, event: str, **fields: LogValue) -> None:
        self.events.append(event)

    def warning(self, event: str, **fields: LogValue) -> None:
        self.events.append(event)

    def error(self, event: str, *, exc: BaseException | None = None, **fields: LogValue) -> None:
        self.events.append(event)


@pytest.fixture
def anthropic_requests() -> list[httpx.Request]:
    return []


@pytest.fixture
def anthropic_logger() -> RecordingLogger:
    return RecordingLogger()


@pytest.fixture
def anthropic_build(
    characteristics_dir: Path,
    anthropic_requests: list[httpx.Request],
    anthropic_logger: RecordingLogger,
) -> AnthropicBuild:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)

    def build(
        handler: Callable[[httpx.Request], httpx.Response],
        *,
        fallback_model: str | None = None,
        base_url: str = "https://api.anthropic.com/v1",
    ) -> AnthropicLLM:
        def record(request: httpx.Request) -> httpx.Response:
            anthropic_requests.append(request)
            return handler(request)

        return AnthropicLLM(
            registry=registry,
            logger=anthropic_logger,
            api_key="test-secret",
            model="claude-sonnet-4-6",
            timeout_s=30,
            fallback_model=fallback_model,
            base_url=base_url,
            transport=httpx.MockTransport(record),
        )

    return build


def message(content: object) -> httpx.Response:
    text = content if isinstance(content, str) else json.dumps(content)
    return httpx.Response(
        200,
        json={"stop_reason": "end_turn", "content": [{"type": "text", "text": text}]},
    )
