import json
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest

from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.domain.errors import ModelFailure


async def parse_scope(characteristics_dir: Path, query: str, scope: str, quote: str) -> str:
    calls = []

    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content))
        payload = {
            "location_hint": "Санкт-Петербург",
            "spatial_requests": [
                {
                    "kind": "landmark_view",
                    "target": "Эрмитаж",
                    "source_text": query,
                    "radius_m": 2000,
                    "target_part": "whole",
                }
            ],
        }
        if len(calls) > 1:
            payload = {"scopes": [{"id": "0", "scope": scope, "quote": quote}]}
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(payload)}}]}
        )

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
        parsed = await llm.parse_query(query)
        if len(calls) > 1:
            assert calls[1]["temperature"] == 0
        return parsed.spatial_requests[0].target_part
    finally:
        await llm.aclose()


async def test_clear_sightline_does_not_silently_become_whole_object_requirement(
    characteristics_dir: Path,
) -> None:
    query = "вид на Эрмитаж без здания перед окнами"
    assert await parse_scope(characteristics_dir, query, "any", "без здания перед окнами") == "any"


async def test_explicit_entire_object_request_is_preserved(characteristics_dir: Path) -> None:
    query = "хочу видеть Эрмитаж целиком"
    assert (
        await parse_scope(characteristics_dir, query, "whole", "видеть Эрмитаж целиком") == "whole"
    )


async def test_unquoted_scope_correction_is_rejected(characteristics_dir: Path) -> None:
    with pytest.raises(ModelFailure):
        await parse_scope(characteristics_dir, "вид на Эрмитаж целиком", "any", "придуманный текст")
