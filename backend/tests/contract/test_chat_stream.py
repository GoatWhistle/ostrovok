import json
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application import progress
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.errors import ConversationNotFound
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.interfaces.http.routers.chat import build_router
from hotel_agent.interfaces.http.search_schemas import search_schema
from tests.unit.application.test_chat_conversations import FakeChatRepository, FakeUnitOfWork


def events(body: str) -> list[tuple[str, dict[str, Any]]]:
    parsed = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        parsed.append((lines["event"], json.loads(lines["data"])))
    return parsed


def build(characteristics_dir: Path, search: AsyncMock) -> TestClient:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    repository = FakeChatRepository()
    chat = Chat(
        FakeLLM(registry),
        cast(UnitOfWorkFactory, lambda: FakeUnitOfWork(repository, [])),
        cast(SearchHotels, search),
        lambda r: search_schema(r, registry, 0).model_dump(mode="json"),
        registry,
    )
    app = FastAPI()
    app.include_router(build_router(chat, registry))
    return TestClient(app)


def found() -> AsyncMock:
    async def run(*_: object, **__: object) -> SearchOutcome:
        progress.step("candidates", found=3, region="russia")
        progress.step("wish", term="у моря", status="matched")
        return SearchOutcome(
            query_id="q",
            parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
            results=(),
        )

    return AsyncMock(side_effect=run)


def test_the_stream_reports_progress_before_the_answer(
    characteristics_dir: Path, validate: Any
) -> None:
    with build(characteristics_dir, found()) as client:
        response = client.post("/chat/messages/stream", json={"message": "Отель в Сочи у моря"})

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        received = events(response.text)
        assert [name for name, _ in received[:-1]] == ["progress", "progress"]
        assert received[0][1] == {"stage": "candidates", "found": 3, "region": "russia"}
        assert received[1][1] == {"stage": "wish", "term": "у моря", "status": "matched"}
        assert received[-1][0] == "result"
        validate("Conversation", received[-1][1])


def test_a_failed_search_ends_the_stream_with_the_error_envelope(
    characteristics_dir: Path,
) -> None:
    with build(characteristics_dir, AsyncMock(side_effect=ConversationNotFound())) as client:
        response = client.post("/chat/messages/stream", json={"message": "Отель в Сочи"})

        assert response.status_code == 200
        name, payload = events(response.text)[-1]
        assert name == "error"
        assert payload["code"] == ConversationNotFound.code
