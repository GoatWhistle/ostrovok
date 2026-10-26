import json
from pathlib import Path
from unittest.mock import MagicMock

import httpx

from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry


async def test_evidence_verification_uses_zero_temperature_not_exploration_mode(
    characteristics_dir: Path,
) -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"verdicts":[]}'}}]})

    llm = OpenAICompatLLM(
        registry=YamlCharacteristicRegistry.from_directory(characteristics_dir),
        logger=MagicMock(),
        base_url="https://model.test",
        api_key="test",
        model="test",
        timeout_s=5,
        transport=httpx.MockTransport(respond),
    )
    try:
        await llm.verify_evidence('{"mode":"recommendation_scope","records":[]}')
        request = json.loads(requests[0].content)
        assert request["temperature"] == 0
        assert request["max_tokens"] == 4000
    finally:
        await llm.aclose()
