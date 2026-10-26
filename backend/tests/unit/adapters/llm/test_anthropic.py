import json
from typing import Any

import httpx
import pytest

from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.domain.errors import ModelFailure
from hotel_agent.domain.query import ParsedQuery

from .conftest import AnthropicBuild, message


def parsed_answer(weight: float = 0.8) -> dict[str, Any]:
    return {
        "intents": [
            {
                "characteristic_key": "noise_level",
                "op": "lte",
                "value": 3,
                "weight": weight,
                "required": False,
                "source_text": "тихий",
            }
        ],
        "unmatched_terms": [],
        "location_hint": "Сочи",
        "anywhere": False,
        "normalized_query": "тихий отель в Сочи",
        "needs_clarification": False,
        "wants_room": False,
        "room_preferences_unrestricted": False,
        "budget": None,
        "check_in": None,
        "check_out": None,
        "adults": None,
        "corrections": [],
        "nearby_objects": [],
        "facility_requests": [],
        "spatial_requests": [],
        "wishes": ["тихий"],
    }


async def test_parse_query_sends_anthropic_headers_and_supported_schema(
    anthropic_build: AnthropicBuild, anthropic_requests: list[httpx.Request]
) -> None:
    llm: LLMPort = anthropic_build(lambda request: message(parsed_answer()))
    try:
        parsed = await llm.parse_query("тихий отель в Сочи")
        assert parsed.location_hint == "Сочи"
        assert [(item.characteristic_key, item.value) for item in parsed.intents] == [
            ("noise_level", 3.0)
        ]
        [request] = anthropic_requests
        assert str(request.url) == "https://api.anthropic.com/v1/messages"
        assert request.headers["x-api-key"] == "test-secret"
        assert request.headers["anthropic-version"] == "2026-10-21"
        assert "authorization" not in request.headers
        body = json.loads(request.content)
        assert body["model"] == "claude-sonnet-4-6"
        assert isinstance(body["system"], str)
        assert body["messages"] == [{"role": "user", "content": "тихий отель в Сочи"}]
        assert "response_format" not in body
        assert "temperature" not in body
        assert "reasoning_effort" not in body
        weight = body["output_config"]["format"]["schema"]["properties"]["intents"]
        weight = weight["items"]["properties"]["weight"]
        assert "minimum" not in weight and "maximum" not in weight
        assert "maximum: 1" in weight["description"]
    finally:
        await llm.aclose()


async def test_numeric_constraints_are_checked_after_schema_conversion(
    anthropic_build: AnthropicBuild,
) -> None:
    llm = anthropic_build(lambda request: message(parsed_answer(2)))
    try:
        with pytest.raises(ModelFailure, match="outside the requested schema"):
            await llm.parse_query("тихий отель в Сочи")
    finally:
        await llm.aclose()


@pytest.mark.parametrize("answer", [{"intents": []}, "prose instead of JSON"])
async def test_incomplete_or_non_json_structured_answer_fails(
    anthropic_build: AnthropicBuild, answer: object
) -> None:
    llm = anthropic_build(lambda request: message(answer))
    try:
        with pytest.raises(ModelFailure):
            await llm.parse_query("тихий отель")
    finally:
        await llm.aclose()


async def test_chat_context_and_questions_use_plain_text(
    anthropic_build: AnthropicBuild, anthropic_requests: list[httpx.Request]
) -> None:
    llm = anthropic_build(lambda request: message("  тихий отель в Сочи  "))
    try:
        assert await llm.contextualize_query(None, "Сочи") == "Сочи"
        assert anthropic_requests == []
        assert (
            await llm.contextualize_query("Сочи", "тихий", (("user", "Сочи"),))
            == "тихий отель в Сочи"
        )
        question = await llm.formulate_question("noise_level", "нужны данные", "Отель")
        assert question.text == "тихий отель в Сочи"
        for request in anthropic_requests:
            assert "output_config" not in json.loads(request.content)
    finally:
        await llm.aclose()


async def test_tool_plan_drops_unknown_subjects(anthropic_build: AnthropicBuild) -> None:
    llm = anthropic_build(
        lambda request: message(
            {
                "calls": [
                    {"characteristic_key": "distance_to_sea", "subject": "hotel-1"},
                    {"characteristic_key": "distance_to_sea", "subject": "invented"},
                ]
            }
        )
    )
    try:
        calls = await llm.plan_tools(
            ParsedQuery(intents=(), unmatched_terms=(), location_hint=None), ("hotel-1",), {}
        )
        assert [(call.characteristic_key, call.subject) for call in calls] == [
            ("distance_to_sea", "hotel-1")
        ]
    finally:
        await llm.aclose()


async def test_extraction_drops_ungrounded_quotes(anthropic_build: AnthropicBuild) -> None:
    llm = anthropic_build(
        lambda request: message(
            {
                "fields": [
                    {"name": "fee_rub", "value": 1500, "quote": "1500 ₽"},
                    {"name": "fee_rub", "value": 700, "quote": "700 ₽"},
                ]
            }
        )
    )
    try:
        extraction = await llm.extract_fields("pets_policy", "С собакой можно за 1500 ₽")
        assert [(field.name, field.value) for field in extraction.fields] == [("fee_rub", 1500)]
    finally:
        await llm.aclose()


async def test_agent_exploration_and_evidence_use_structured_output(
    anthropic_build: AnthropicBuild, anthropic_requests: list[httpx.Request]
) -> None:
    arguments: dict[str, object] = dict.fromkeys(
        [
            "offset",
            "limit",
            "query",
            "url",
            "hotel_id",
            "at",
            "direction_deg",
            "observer_height_m",
            "check_in",
            "check_out",
            "adults",
            "term",
            "radius_m",
            "search_radius_m",
            "dataset",
        ]
    )
    arguments.update(hotel_ids=[], filters=[])
    answers = iter(
        [
            {
                "action": "finish",
                "arguments": arguments,
                "criteria": [],
                "question": None,
                "reason": "Проверка завершена по доступным источникам.",
                "irrelevant_sources": [],
            },
            {"verdicts": [{"record_id": "hotel-1", "supported": True, "quote": "Бассейн"}]},
        ]
    )
    llm = anthropic_build(lambda request: message(next(answers)))
    try:
        step = await llm.explore_data('{"remaining_tool_calls": 0}')
        assert step.action == "finish"
        [verdict] = await llm.verify_evidence("Бассейн")
        assert verdict.record_id == "hotel-1" and verdict.supported
        for request in anthropic_requests:
            body = json.loads(request.content)
            assert body["max_tokens"] == 2000
            assert body["output_config"]["format"]["type"] == "json_schema"
    finally:
        await llm.aclose()
