import asyncio
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import DemandRecord, SearchHotelRecord
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.answer_questions import AnswerHotelierQuestions
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.get_fact import GetFact
from hotel_agent.application.use_cases.hotelier_cabinet import GetHotelierCabinet
from hotel_agent.application.use_cases.hotelier_notifications import (
    ListHotelierNotifications,
    MarkNotificationsRead,
)
from hotel_agent.application.use_cases.hotelier_questions import (
    ChangeQuestionStatus,
    ListHotelierQuestions,
)
from hotel_agent.application.use_cases.state_fact import StateHotelierFact
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.interfaces.http.hotelier_schemas import fact_detail_schema
from hotel_agent.interfaces.http.routers import hotelier
from tests.unit.application.hotelier_fakes import (
    FixedClock,
    Ids,
    Store,
    computed_fact,
    factory,
    question,
)

HOTEL = SearchHotelRecord(
    id="h1",
    region_id="sochi",
    name="Hotel One",
    location=(39.72, 43.58),
    stars=4,
    building_id="b1",
    height_m=12.0,
    levels=4,
    footprint=None,
)


@pytest.fixture
def store() -> Store:
    built = Store(
        facts={"f_h": computed_fact("f_h", "h1", "building_height", 12.0)},
        questions={"q1": question("q1", "h1", "pets_policy")},
        demand=[
            DemandRecord(hotel_id="h1", characteristic_key="pets_policy", appearances=9, blocked=6)
        ],
        appearances=9,
    )
    built.hotel_records["h1"] = HOTEL
    return built


@pytest.fixture
def client(store: Store, characteristics_dir: Path) -> TestClient:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    app = FastAPI()
    ErrorHandlers(StdlibLogger("contract")).register(app)
    uow = factory(store)
    answer = AnswerHotelierQuestion(uow, registry, FakeLLM(registry), FixedClock(), Ids())
    app.include_router(
        hotelier.build_router(
            ListHotelierQuestions(uow),
            answer,
            ChangeQuestionStatus(uow),
            ChangeFacts(uow, registry, FixedClock(), Ids()),
            GetHotelierCabinet(uow, registry, FixedClock()),
            ListHotelierNotifications(uow, registry),
            MarkNotificationsRead(uow, FixedClock()),
            AnswerHotelierQuestions(uow, FakeLLM(registry), answer),
            StateHotelierFact(uow, registry, FakeLLM(registry), FixedClock(), Ids()),
        )
    )
    return TestClient(app)


def check_answer(contract: dict[str, Any], validate: Any, payload: dict[str, Any]) -> None:
    operation = contract["paths"]["/hotelier/questions/{question_id}/answer"]["post"]
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert set(payload) <= set(schema["properties"])
    for item in payload["extracted"]:
        validate("Fact", item)
    for item in payload["conflicts"]:
        validate("Conflict", item)
    if "follow_up" in payload:
        validate("HotelierQuestion", payload["follow_up"])


def test_a_structured_answer_needs_no_model(client: TestClient, validate: Any) -> None:
    response = client.post(
        "/hotelier/questions/q1/answer",
        json={"fields": {"allowed": True, "max_weight_kg": 8, "fee_rub": 1500}},
    )

    assert response.status_code == 200
    fact = response.json()["extracted"][0]
    validate("Fact", fact)
    assert fact["value"] == {"allowed": True, "max_weight_kg": 8.0, "fee_rub": 1500.0}
    assert fact["provenance"]["method"] == "hotelier_fields@1"
    assert fact["provenance"]["confidence"] == 1.0
    assert [item["kind"] for item in fact["provenance"]["evidence"]] == ["param"] * 3
    assert fact["provenance"]["evidence"][0]["text"] == "allowed=true"
    assert client.get("/hotelier/h1/questions").json()["items"][0]["status"] == "answered"


def test_question_queue_and_answers_match_contract(
    client: TestClient, contract: dict[str, Any], validate: Any
) -> None:
    queue = client.get("/hotelier/h1/questions")
    assert queue.status_code == 200
    validate("HotelierQuestion", queue.json()["items"][0])
    unclear = client.post("/hotelier/questions/q1/answer", json={"text": "Уточню позже"})
    assert unclear.status_code == 200
    assert unclear.json()["follow_up"]["status"] == "open"
    check_answer(contract, validate, unclear.json())
    answered = client.post(
        "/hotelier/questions/q1/answer", json={"text": "Можно с собакой до 10 кг"}
    )
    assert answered.status_code == 200
    assert "follow_up" not in answered.json()
    check_answer(contract, validate, answered.json())
    assert answered.json()["extracted"][0]["provenance"]["evidence"][0]["kind"] == "quote"


def test_question_deferral_and_saved_answer_match_contract(
    client: TestClient, validate: Any
) -> None:
    skipped = client.patch("/hotelier/questions/q1", json={"status": "skipped"})
    assert skipped.status_code == 200
    validate("HotelierQuestion", skipped.json())
    assert skipped.json()["status"] == "skipped"
    assert client.get("/hotelier/h1/questions").json()["items"][0]["status"] == "skipped"
    reopened = client.patch("/hotelier/questions/q1", json={"status": "open"})
    assert reopened.json()["status"] == "open"
    client.post("/hotelier/questions/q1/answer", json={"text": "Можно с собакой до 10 кг"})
    saved = client.get("/hotelier/h1/questions").json()["items"][0]
    validate("HotelierQuestion", saved)
    assert saved["status"] == "answered"
    assert saved["answer_text"] == "Можно с собакой до 10 кг"
    assert len(saved["answer_fact_ids"]) == 1
    conflict = client.patch("/hotelier/questions/q1", json={"status": "open"})
    assert conflict.status_code == 409
    validate("Error", conflict.json())
    assert conflict.json()["code"] == "question_answered"


def test_confirm_and_correct_return_facts(client: TestClient, validate: Any) -> None:
    confirmed = client.post("/facts/f_h/confirm")
    assert confirmed.status_code == 200
    validate("Fact", confirmed.json())
    corrected = client.post("/facts/f_h/correct", json={"value": 0, "comment": "Снесено"})
    assert corrected.status_code == 200
    validate("Fact", corrected.json())
    assert corrected.json()["value"] == 0


def test_fact_detail_keeps_history_and_conflicts(store: Store, validate: Any) -> None:
    async def run() -> dict[str, Any]:
        await ChangeFacts(factory(store), _registry(), FixedClock(), Ids()).correct("f_h", 15, "")
        detail = await GetFact(factory(store))("h1", "f_h")
        return fact_detail_schema(detail).model_dump(mode="json")

    payload = asyncio.run(run())
    validate("FactDetail", payload)
    assert payload["status"] == "superseded"
    assert payload["history"][0]["status"] == "confirmed_by_hotelier"


def test_the_cabinet_overview_matches_the_contract(client: TestClient, validate: Any) -> None:
    response = client.get("/hotelier/h1/overview")

    assert response.status_code == 200
    payload = response.json()
    validate("HotelierOverview", payload)
    assert payload["appearances"] == 9
    assert payload["next_action"]["kind"] == "answer_question"
    assert payload["questions"][0]["blocked_searches"] == 6
    validate("CoverageSummary", payload["coverage"])
    validate("CharacteristicState", payload["characteristics"][0])
    validate("QueuedQuestion", payload["questions"][0])
    validate("HotelierAttention", payload["next_action"])


def test_the_notification_feed_matches_the_contract(client: TestClient, validate: Any) -> None:
    client.post("/hotelier/questions/q1/answer", json={"text": "Можно с собакой до 10 кг"})

    feed = client.get("/hotelier/h1/notifications")
    assert feed.status_code == 200
    validate("HotelierNotificationFeed", feed.json())
    validate("HotelierNotification", feed.json()["items"][0])
    validate("NotificationCounters", feed.json()["unread"])
    assert feed.json()["unread"]["total"] == 1

    nothing = client.post("/hotelier/h1/notifications/read", json={"ids": []})
    assert nothing.status_code == 200
    assert nothing.json()["read"] == 0
    assert nothing.json()["unread"]["total"] == 1

    read = client.post("/hotelier/h1/notifications/read")
    assert read.status_code == 200
    assert read.json()["read"] == 1
    assert read.json()["unread"]["total"] == 0
    assert client.get("/hotelier/h1/notifications?unread_only=true").json()["items"] == []


def test_one_message_answers_the_queue(client: TestClient, validate: Any) -> None:
    response = client.post(
        "/hotelier/h1/answers", json={"text": "С собаками до 10 кг, доплата 2500 рублей"}
    )

    assert response.status_code == 200
    validate("BatchAnswerResult", response.json())
    assert response.json()["applied"][0]["question_id"] == "q1"
    assert client.get("/hotelier/h1/questions?status=answered").json()["items"][0]["id"] == "q1"
    assert client.get("/hotelier/h1/questions?status=open").json()["items"] == []


def test_a_hotelier_states_a_value_nobody_asked_about(client: TestClient, validate: Any) -> None:
    response = client.post(
        "/hotelier/h1/facts",
        json={
            "characteristic_key": "pets_policy",
            "text": "Можно с собаками до 10 кг, доплата 2500 рублей",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    validate("Fact", payload["fact"])
    assert payload["hotel_id"] == "h1"
    assert payload["fact"]["provenance"]["method"] == "hotelier_statement@1"
    assert payload["fact"]["provenance"]["source_type"] == "hotelier"
    assert payload["fact"]["provenance"]["evidence"][0]["kind"] == "quote"
    assert payload["fact"]["status"] == "confirmed_by_hotelier"
    assert payload["conflicts"] == []


@pytest.mark.parametrize(
    ("method", "path", "body", "status", "code"),
    [
        ("get", "/hotelier/missing/questions", None, 404, "not_found"),
        ("post", "/hotelier/questions/missing/answer", {"text": "Можно"}, 404, "not_found"),
        ("post", "/hotelier/questions/q1/answer", {"text": ""}, 422, "invalid_value"),
        ("post", "/hotelier/questions/q1/answer", {"fields": {}}, 422, "invalid_value"),
        (
            "post",
            "/hotelier/questions/q1/answer",
            {"fields": {"nope": True}},
            422,
            "invalid_value",
        ),
        (
            "post",
            "/hotelier/questions/q1/answer",
            {"fields": {"max_weight_kg": -1}},
            422,
            "invalid_value",
        ),
        (
            "post",
            "/hotelier/questions/q1/answer",
            {"text": "Можно", "extra": 1},
            422,
            "validation_error",
        ),
        ("patch", "/hotelier/questions/missing", {"status": "skipped"}, 404, "not_found"),
        ("patch", "/hotelier/questions/q1", {"status": "answered"}, 422, "validation_error"),
        ("patch", "/hotelier/questions/q1", {"status": "skipped", "x": 1}, 422, "validation_error"),
        ("post", "/facts/missing/confirm", None, 404, "not_found"),
        ("post", "/facts/f_h/correct", {"comment": "без значения"}, 422, "validation_error"),
        ("post", "/facts/f_h/correct", {"value": "высокий"}, 422, "invalid_value"),
        ("get", "/hotelier/missing/overview", None, 404, "not_found"),
        ("get", "/hotelier/missing/notifications", None, 404, "not_found"),
        ("get", "/hotelier/h1/notifications?limit=0", None, 422, "validation_error"),
        ("get", "/hotelier/h1/notifications?cursor=broken", None, 422, "invalid_query"),
        ("get", "/hotelier/h1/questions?status=unknown", None, 422, "validation_error"),
        ("post", "/hotelier/missing/notifications/read", None, 404, "not_found"),
        ("post", "/hotelier/missing/answers", {"text": "Можно"}, 404, "not_found"),
        ("post", "/hotelier/h1/answers", {"text": ""}, 422, "validation_error"),
        (
            "post",
            "/hotelier/missing/facts",
            {"characteristic_key": "pets_policy", "text": "Можно"},
            404,
            "not_found",
        ),
        (
            "post",
            "/hotelier/h1/facts",
            {"characteristic_key": "nope", "text": "Можно"},
            422,
            "unknown_characteristic",
        ),
        (
            "post",
            "/hotelier/h1/facts",
            {"characteristic_key": "pets_policy", "text": "привет"},
            422,
            "invalid_value",
        ),
        ("post", "/hotelier/h1/facts", {"text": "Можно"}, 422, "validation_error"),
    ],
)
def test_errors_use_the_envelope(
    client: TestClient,
    validate: Any,
    method: str,
    path: str,
    body: object,
    status: int,
    code: str,
) -> None:
    response = client.request(method.upper(), path, json=body)
    assert response.status_code == status
    validate("Error", response.json())
    assert response.json()["code"] == code


def _registry() -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(
        Path(__file__).resolve().parents[3] / "characteristics"
    )
