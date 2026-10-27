from pathlib import Path
from typing import cast
from unittest.mock import AsyncMock

import httpx
import psycopg
from fastapi import FastAPI
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.interfaces.http.routers.chat import build_router
from hotel_agent.interfaces.http.search_schemas import search_schema


async def test_consult_search_and_hotel_advice_preserve_real_conversation(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
    characteristics_dir: Path,
) -> None:
    assert isinstance(catalog_pool.conninfo, str)
    uow = PostgresUnitOfWorkFactory(catalog_pool.conninfo)
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    search = AsyncMock(
        return_value=SearchOutcome(
            query_id="query-1",
            parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
            results=(),
        )
    )
    chat = Chat(
        FakeLLM(registry),
        uow,
        cast(SearchHotels, search),
        lambda result: search_schema(result, registry, 0).model_dump(mode="json"),
        registry,
        GetHotelCard(uow, SystemClock()),
    )
    app = FastAPI()
    app.include_router(build_router(chat, registry), prefix="/api/v1")
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://test"
        ) as client:
            initial = await client.post(
                "/api/v1/chat/messages", json={"message": "Привет", "region_id": "test"}
            )
            assert initial.status_code == 200, initial.text
            body = initial.json()
            identifier = body["id"]
            assert (
                body["search"] is None
                and body["effective_query"] is None
                and body["search_message_id"] is None
            )
            search.assert_not_awaited()
            found = (
                await client.post(
                    "/api/v1/chat/messages",
                    json={"conversation_id": identifier, "message": "Найди отель в Сочи"},
                )
            ).json()
            search.assert_awaited_once()
            assert found["search"]["query_id"] == "query-1"
            message_id = found["search_message_id"]
            assert message_id == found["messages"][-1]["id"]
            advice = (
                await client.post(
                    "/api/v1/chat/messages",
                    json={"conversation_id": identifier, "message": "Что значит полупансион?"},
                )
            ).json()
            assert advice["effective_query"] == found["effective_query"]
            assert advice["search"] == found["search"] and advice["search_message_id"] == message_id
            hotel = (
                await client.post(
                    "/api/v1/chat/messages",
                    json={
                        "conversation_id": identifier,
                        "message": "Что известно о номерах?",
                        "selected_hotel_id": "local-1",
                    },
                )
            ).json()
            assert "Hotel One" in hotel["messages"][-1]["content"]
            assert hotel["search_message_id"] == message_id
            loaded = (await client.get(f"/api/v1/chat/conversations/{identifier}")).json()
            assert len(loaded["messages"]) == 8 and loaded["search_message_id"] == message_id
            assert search.await_count == 1
    finally:
        await uow.aclose()
