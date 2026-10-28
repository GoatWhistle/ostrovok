import asyncio
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.interfaces.http.routers.chat import build_router
from hotel_agent.interfaces.http.search_schemas import search_schema
from tests.unit.application.test_chat_conversations import FakeChatRepository, FakeUnitOfWork


def test_chat_contract_accepts_consultation_and_preserves_search_message(
    characteristics_dir: Path,
    validate: Any,
) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    repository = FakeChatRepository()
    search = AsyncMock(
        return_value=SearchOutcome(
            query_id="q",
            parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
            results=(),
        )
    )
    chat = Chat(
        FakeLLM(registry),
        cast(UnitOfWorkFactory, lambda: FakeUnitOfWork(repository, [])),
        cast(SearchHotels, search),
        lambda r, took_ms: search_schema(r, registry, took_ms).model_dump(mode="json"),
        registry,
    )
    app = FastAPI()
    app.include_router(build_router(chat, registry))
    with TestClient(app) as client:
        greeting = client.post("/chat/messages", json={"message": "Привет"}).json()
        validate("Conversation", greeting)
        assert greeting["search"] is None and greeting["search_message_id"] is None
        found = client.post(
            "/chat/messages",
            json={"conversation_id": greeting["id"], "message": "Найди отель в Сочи"},
        ).json()
        validate("Conversation", found)
        advice = client.post(
            "/chat/messages", json={"conversation_id": greeting["id"], "message": "Спасибо"}
        ).json()
        validate("Conversation", advice)
        assert found["search_message_id"] == advice["search_message_id"]
        assert advice["search"] == found["search"] and search.await_count == 1


def test_chat_reports_the_time_the_search_actually_took(
    characteristics_dir: Path,
    validate: Any,
) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    repository = FakeChatRepository()

    async def slow(*args: object, **kwargs: object) -> SearchOutcome:
        await asyncio.sleep(0.05)
        return SearchOutcome(
            query_id="q",
            parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
            results=(),
        )

    chat = Chat(
        FakeLLM(registry),
        cast(UnitOfWorkFactory, lambda: FakeUnitOfWork(repository, [])),
        cast(SearchHotels, slow),
        lambda r, took_ms: search_schema(r, registry, took_ms).model_dump(mode="json"),
        registry,
    )
    app = FastAPI()
    app.include_router(build_router(chat, registry))
    with TestClient(app) as client:
        found = client.post("/chat/messages", json={"message": "Найди отель в Сочи"}).json()

    validate("Conversation", found)
    assert found["search"] is not None
    assert found["search"]["took_ms"] >= 50
