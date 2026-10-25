import json
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import pytest

from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.log import LogValue
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.errors import ModelFailure
from hotel_agent.domain.query import ParsedQuery

type Build = Callable[..., OpenAICompatLLM]


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
def logger() -> RecordingLogger:
    return RecordingLogger()


@pytest.fixture
def build(characteristics_dir: Path, logger: RecordingLogger) -> Build:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    sent: list[dict[str, Any]] = []

    def make(
        answer: object = "",
        *,
        status: int = 200,
        error: Exception | None = None,
    ) -> OpenAICompatLLM:
        def handle(request: httpx.Request) -> httpx.Response:
            if error is not None:
                raise error
            sent.append(json.loads(request.content))
            content = answer if isinstance(answer, str) else json.dumps(answer)
            body = {"choices": [{"message": {"role": "assistant", "content": content}}]}
            return httpx.Response(status, json=body)

        llm = OpenAICompatLLM(
            registry=registry,
            logger=logger,
            base_url="https://llm.api.cloud.yandex.net/v1",
            api_key="secret",
            model="gpt://folder/yandexgpt-5.1/latest",
            timeout_s=5.0,
            transport=httpx.MockTransport(handle),
        )
        llm.sent = sent  # type: ignore[attr-defined]
        return llm

    return make


def intent(key: str, op: str, value: object, source: str) -> dict[str, object]:
    return {
        "characteristic_key": key,
        "op": op,
        "value": value,
        "weight": 1.0,
        "required": False,
        "source_text": source,
    }


async def test_a_structured_answer_becomes_intents(build: Build) -> None:
    llm = build(
        {
            "intents": [
                intent("noise_level", "lte", 3, "тихий номер"),
                intent("sunset_view", "eq", True, "с видом на закат"),
            ],
            "unmatched_terms": ["балкон"],
            "location_hint": "Сочи",
        }
    )

    parsed = await llm.parse_query("тихий номер с видом на закат и балконом")

    assert [(item.characteristic_key, item.op, item.value) for item in parsed.intents] == [
        ("noise_level", Op.LTE, 3.0),
        ("sunset_view", Op.EQ, True),
    ]
    assert parsed.unmatched_terms == ("балкон",)
    assert parsed.location_hint == "Сочи"


async def test_room_request_keeps_only_explicit_stay_details(build: Build) -> None:
    llm = build(
        {
            "intents": [],
            "unmatched_terms": [],
            "wants_room": True,
            "check_in": "2026-11-01",
            "check_out": "2026-11-04",
            "adults": 2,
        }
    )

    parsed = await llm.parse_query("номер для двух взрослых с 1 по 4 ноября")

    assert parsed.wants_room
    assert parsed.check_in == date(2026, 11, 1)
    assert parsed.check_out == date(2026, 11, 4)
    assert parsed.adults == 2


async def test_four_guest_room_is_a_capacity_intent(build: Build) -> None:
    llm = build(
        {
            "intents": [intent("room_capacity", "gte", 4, "на 4-х")],
            "unmatched_terms": ["бассейн"],
            "wants_room": True,
            "adults": None,
        }
    )

    parsed = await llm.parse_query("хочу номер на 4-х с бассейном")

    assert [(item.characteristic_key, item.value) for item in parsed.intents] == [
        ("room_capacity", 4.0)
    ]
    assert parsed.adults is None


async def test_arbitrary_hotel_services_are_tool_requests(build: Build) -> None:
    llm = build(
        {
            "intents": [],
            "facility_requests": [
                {"term": "бассейн", "source_text": "с бассейном", "required": False},
                {"term": "шведский стол", "source_text": "шведским столом", "required": False},
            ],
            "unmatched_terms": [],
        }
    )

    parsed = await llm.parse_query("хочу отель с бассейном и шведским столом")

    assert [item.term for item in parsed.facility_requests] == ["бассейн", "шведский стол"]


async def test_the_request_carries_the_model_and_a_strict_schema(build: Build) -> None:
    llm = build({"intents": [], "unmatched_terms": []})

    await llm.parse_query("тихий номер")

    [request] = llm.sent  # type: ignore[attr-defined]
    assert request["model"] == "gpt://folder/yandexgpt-5.1/latest"
    assert request["temperature"] == 0
    schema = request["response_format"]["json_schema"]
    assert schema["strict"] is True
    keys = schema["schema"]["properties"]["intents"]["items"]["properties"]
    assert "distance_to_sea" in keys["characteristic_key"]["enum"]


async def test_a_follow_up_is_rewritten_with_previous_conditions(build: Build) -> None:
    llm = build("Двухместный номер в Сочи рядом с магазинами, до моря пешком 5 минут")

    query = await llm.contextualize_query(
        "Двухместный номер в Сочи рядом с магазинами", "а до моря пешком 5 минут"
    )

    assert query == "Двухместный номер в Сочи рядом с магазинами, до моря пешком 5 минут"
    [request] = llm.sent  # type: ignore[attr-defined]
    assert "Двухместный номер в Сочи рядом с магазинами" in request["messages"][1]["content"]
    assert "а до моря пешком 5 минут" in request["messages"][1]["content"]


async def test_transient_connection_failure_is_retried(
    characteristics_dir: Path, logger: RecordingLogger
) -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ConnectError("temporary", request=request)
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "hotel near the sea"}}]}
        )

    llm = OpenAICompatLLM(
        registry=YamlCharacteristicRegistry.from_directory(characteristics_dir),
        logger=logger,
        base_url="https://example.com/v1",
        api_key="secret",
        model="test",
        timeout_s=5,
        transport=httpx.MockTransport(handle),
    )

    assert await llm.contextualize_query("hotel", "near the sea") == "hotel near the sea"
    assert calls == 2


async def test_a_nearby_place_request_is_kept_as_tool_input(build: Build) -> None:
    llm = build(
        {
            "intents": [intent("double_room", "eq", True, "2х местный номер")],
            "nearby_objects": [
                {
                    "osm_key": "shop",
                    "osm_value": "*",
                    "open_24h": True,
                    "radius_m": 500,
                    "source_text": "круглосуточными магазинами",
                }
            ],
            "unmatched_terms": [],
            "location_hint": "Сочи",
        }
    )

    parsed = await llm.parse_query("2х местный номер с круглосуточными магазинами")

    assert [item.characteristic_key for item in parsed.intents] == ["double_room"]
    assert [(item.osm_key, item.osm_value, item.open_24h) for item in parsed.nearby_objects] == [
        ("shop", "*", True)
    ]


async def test_model_invents_no_unmentioned_or_wrongly_typed_intents(
    build: Build, logger: RecordingLogger
) -> None:
    llm = build(
        {
            "intents": [
                intent("double_room", "eq", True, "2х местный номер"),
                intent("distance_to_sea", "lte", True, "круглосуточными магазинами"),
                intent("pets_policy", "eq", True, "2х местный номер"),
            ],
            "nearby_objects": [],
            "unmatched_terms": [],
            "location_hint": "Сочи",
        }
    )

    parsed = await llm.parse_query("хочу 2х местный номер в Сочи с круглосуточными магазинами")

    assert [item.characteristic_key for item in parsed.intents] == ["double_room"]
    assert "llm_invalid_intent_value" in logger.events
    assert "llm_ungrounded_pets_policy" in logger.events


async def test_zoos_can_be_requested_with_a_ten_kilometre_radius(build: Build) -> None:
    llm = build(
        {
            "intents": [],
            "nearby_objects": [
                {
                    "osm_key": "tourism",
                    "osm_value": "zoo",
                    "open_24h": False,
                    "radius_m": 10000,
                    "source_text": "зоопарк в радиусе 10 км",
                }
            ],
            "unmatched_terms": [],
            "location_hint": None,
        }
    )

    parsed = await llm.parse_query("хочу зоопарк в радиусе 10 км")

    assert [(item.osm_key, item.osm_value, item.radius_m) for item in parsed.nearby_objects] == [
        ("tourism", "zoo", 10000)
    ]


async def test_an_invented_characteristic_is_dropped(build: Build, logger: RecordingLogger) -> None:
    llm = build(
        {
            "intents": [
                intent("has_helipad", "eq", True, "вертолётная площадка"),
                intent("noise_level", "lte", 3, "тихий"),
            ],
            "unmatched_terms": [],
        }
    )

    parsed = await llm.parse_query("тихий номер с вертолётной площадкой")

    assert [item.characteristic_key for item in parsed.intents] == ["noise_level"]
    assert "llm_unknown_characteristic" in logger.events


async def test_a_tool_call_for_a_known_fact_is_dropped(
    build: Build, logger: RecordingLogger
) -> None:
    llm = build(
        {
            "calls": [
                {"characteristic_key": "sunset_view", "subject": "hotel:h_1"},
                {"characteristic_key": "sunset_view", "subject": "hotel:h_2"},
                {"characteristic_key": "sunset_view", "subject": "hotel:h_404"},
            ]
        }
    )
    query = ParsedQuery(intents=(), unmatched_terms=(), location_hint=None)

    calls = await llm.plan_tools(query, ["hotel:h_1", "hotel:h_2"], {"hotel:h_1": ["sunset_view"]})

    assert [call.subject for call in calls] == ["hotel:h_2"]
    assert logger.events.count("llm_tool_call_outside_plan") == 2


async def test_fields_are_kept_only_when_the_quote_is_really_there(
    build: Build, logger: RecordingLogger
) -> None:
    llm = build(
        {
            "fields": [
                {"name": "allowed", "value": True, "quote": "с собаками до 10 кг можно"},
                {"name": "fee_rub", "value": 1500, "quote": "1500 ₽ в сутки"},
                {"name": "max_weight_kg", "value": 25, "quote": "до 25 кг без доплаты"},
            ]
        }
    )

    extraction = await llm.extract_fields(
        "pets_policy", "С собаками до 10 кг можно, 1500 ₽ в сутки"
    )

    assert {field.name: field.value for field in extraction.fields} == {
        "allowed": True,
        "fee_rub": 1500.0,
    }
    assert "llm_quote_not_in_answer" in logger.events


async def test_a_field_outside_the_registry_is_dropped(
    build: Build, logger: RecordingLogger
) -> None:
    llm = build({"fields": [{"name": "none", "value": True, "quote": "можно"}]})

    extraction = await llm.extract_fields("pets_policy", "можно")

    assert extraction.fields == ()
    assert "llm_field_outside_registry" in logger.events


async def test_a_question_comes_back_trimmed(build: Build) -> None:
    llm = build("  Можно ли заселяться с питомцами?  ")

    draft = await llm.formulate_question("pets_policy", "missing", "Приморская")

    assert draft == draft.__class__(
        characteristic_key="pets_policy", text="Можно ли заселяться с питомцами?"
    )


async def test_an_empty_question_is_a_failure(build: Build) -> None:
    llm = build("   ")

    with pytest.raises(ModelFailure, match="empty answer"):
        await llm.formulate_question("pets_policy", "missing", "Приморская")


@pytest.mark.parametrize("status", [401, 429, 500])
async def test_an_http_error_becomes_a_model_failure(build: Build, status: int) -> None:
    llm = build({"intents": [], "unmatched_terms": []}, status=status)

    with pytest.raises(ModelFailure, match=f"HTTP {status}"):
        await llm.parse_query("тихий номер")


async def test_an_unreachable_endpoint_becomes_a_model_failure(build: Build) -> None:
    llm = build(error=httpx.ConnectError("no route"))

    with pytest.raises(ModelFailure, match="unreachable"):
        await llm.parse_query("тихий номер")


async def test_timeout_uses_the_configured_backup_model(
    characteristics_dir: Path, logger: RecordingLogger
) -> None:
    models: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        models.append(body["model"])
        if len(models) == 1:
            raise httpx.ReadTimeout("slow model")
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"intents":[],"unmatched_terms":[]}'}}]},
        )

    llm = OpenAICompatLLM(
        registry=YamlCharacteristicRegistry.from_directory(characteristics_dir),
        logger=logger,
        base_url="https://example.test/v1",
        api_key="secret",
        model="primary",
        fallback_model="backup",
        timeout_s=30,
        transport=httpx.MockTransport(handle),
    )

    parsed = await llm.parse_query("отель в Сочи")

    assert parsed.intents == ()
    assert models == ["primary", "backup"]
    assert "llm_request_retry" in logger.events


async def test_prose_instead_of_json_becomes_a_model_failure(build: Build) -> None:
    llm = build("Конечно! Вот что я нашёл:")

    with pytest.raises(ModelFailure):
        await llm.parse_query("тихий номер")


async def test_the_key_never_appears_in_a_failure_message(build: Build) -> None:
    llm = build({"intents": []}, status=401)

    with pytest.raises(ModelFailure) as failure:
        await llm.parse_query("тихий номер")

    assert "secret" not in str(failure.value)
