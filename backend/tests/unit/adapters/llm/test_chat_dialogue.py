import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from hotel_agent.adapters.llm.chat_dialogue import decision
from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.chat_dialogue import ChatMode
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.domain.errors import ModelFailure

from .conftest import AnthropicBuild, RecordingLogger, message


@pytest.mark.parametrize("provider", ["anthropic", "openai"])
@pytest.mark.parametrize(
    "mode,query,reply",
    [
        ("search", "отель в Сочи потише", None),
        ("consult", None, "Полупансион обычно включает завтрак и ещё один приём пищи."),
        ("hotel", None, "В карточке нет подтверждения парковки."),
    ],
)
async def test_structured_chat_routing_uses_same_contract_for_both_providers(
    anthropic_build: AnthropicBuild,
    characteristics_dir: Path,
    provider: str,
    mode: str,
    query: str | None,
    reply: str | None,
) -> None:
    payload = {"mode": mode, "query": query, "reply": reply}
    llm: LLMPort
    if provider == "anthropic":
        llm = anthropic_build(lambda r: message(payload))
    else:
        llm = OpenAICompatLLM(
            registry=YamlCharacteristicRegistry.from_directory(characteristics_dir),
            logger=RecordingLogger(),
            base_url="https://example.org/v1",
            api_key="test",
            model="test",
            timeout_s=1,
            transport=httpx.MockTransport(
                lambda r: httpx.Response(
                    200, json={"choices": [{"message": {"content": json.dumps(payload)}}]}
                )
            ),
        )
    try:
        result = await llm.respond_to_chat(
            json.dumps(
                {
                    "message": "Вопрос",
                    "previous_search_query": None,
                    "selected_hotel": None,
                    "history": [],
                    "locale": "ru",
                }
            )
        )
        assert result.mode is ChatMode(mode) and result.query == query and result.reply == reply
    finally:
        await llm.aclose()


@pytest.mark.parametrize(
    "payload",
    [
        {"mode": "search", "query": None, "reply": "hello"},
        {"mode": "search", "query": " ", "reply": None},
        {"mode": "consult", "query": "отель", "reply": "hello"},
        {"mode": "hotel", "query": None, "reply": ""},
        {"mode": "unknown", "query": None, "reply": "hello"},
    ],
)
def test_invalid_routing_never_becomes_a_search(payload: dict[str, Any]) -> None:
    with pytest.raises(ModelFailure):
        decision(payload)
