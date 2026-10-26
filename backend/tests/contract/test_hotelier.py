import asyncio
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.get_fact import GetFact
from hotel_agent.application.use_cases.hotelier_questions import ListHotelierQuestions
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


@pytest.fixture
def store() -> Store:
    return Store(
        facts={"f_h": computed_fact("f_h", "h1", "building_height", 12.0)},
        questions={"q1": question("q1", "h1", "pets_policy")},
    )


@pytest.fixture
def client(store: Store, characteristics_dir: Path) -> TestClient:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    app = FastAPI()
    ErrorHandlers(StdlibLogger("contract")).register(app)
    uow = factory(store)
    app.include_router(
        hotelier.build_router(
            ListHotelierQuestions(uow),
            AnswerHotelierQuestion(uow, registry, FakeLLM(registry), FixedClock(), Ids()),
            ChangeFacts(uow, registry, FixedClock(), Ids()),
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


@pytest.mark.parametrize(
    ("method", "path", "body", "status", "code"),
    [
        ("get", "/hotelier/missing/questions", None, 404, "not_found"),
        ("post", "/hotelier/questions/missing/answer", {"text": "Можно"}, 404, "not_found"),
        ("post", "/hotelier/questions/q1/answer", {"text": ""}, 422, "validation_error"),
        ("post", "/facts/missing/confirm", None, 404, "not_found"),
        ("post", "/facts/f_h/correct", {"comment": "без значения"}, 422, "validation_error"),
        ("post", "/facts/f_h/correct", {"value": "высокий"}, 422, "invalid_value"),
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
