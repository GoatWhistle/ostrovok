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
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.interfaces.http.routers.chat import build_router
from hotel_agent.interfaces.http.search_schemas import search_schema
from tests.integration.repository.postgres.hotelier_setup import new_id, seed_hotel


async def test_consult_search_and_hotel_advice_preserve_real_conversation(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
    characteristics_dir: Path,
) -> None:
    assert isinstance(catalog_pool.conninfo, str)
    uow = PostgresUnitOfWorkFactory(catalog_pool.conninfo)
    region, hotel_id = await seed_hotel(catalog_pool.conninfo)
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
        lambda result, took_ms: search_schema(result, registry, took_ms).model_dump(mode="json"),
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
                "/api/v1/chat/messages", json={"message": "Привет", "region_id": region}
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
                        "selected_hotel_id": hotel_id,
                    },
                )
            ).json()
            assert "Integration hotel" in hotel["messages"][-1]["content"]
            assert hotel["search_message_id"] == message_id
            loaded = (await client.get(f"/api/v1/chat/conversations/{identifier}")).json()
            assert len(loaded["messages"]) == 8 and loaded["search_message_id"] == message_id
            assert search.await_count == 1
    finally:
        await uow.aclose()


async def test_selected_hotel_question_answer_and_card_use_real_storage(
    catalog_pool: AsyncConnectionPool[psycopg.AsyncConnection[tuple[object, ...]]],
    characteristics_dir: Path,
) -> None:
    assert isinstance(catalog_pool.conninfo, str)
    region, hotel_id = await seed_hotel(catalog_pool.conninfo)
    work = PostgresUnitOfWorkFactory(catalog_pool.conninfo)
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    clock = SystemClock()
    search = AsyncMock()
    card = GetHotelCard(work, clock)
    chat = Chat(
        FakeLLM(registry),
        work,
        cast(SearchHotels, search),
        lambda outcome, took_ms: {},
        registry,
        card,
        clock,
    )
    try:
        result = await chat.send(None, "Есть ли в номерах шторы блэкаут?", region, hotel_id)
        async with work() as unit:
            questions = await unit.questions.for_hotel(hotel_id)
        assert len(questions) == 1
        assert questions[0].characteristic_key == "blackout_curtains"
        assert "владельцу" in result.conversation.messages[-1].content
        saved = await AnswerHotelierQuestion(work, registry, FakeLLM(registry), clock, new_id)(
            questions[0].id, "Во всех номерах установлены плотные шторы блэкаут."
        )
        assert saved.extracted[0].value is True
        async with work() as unit:
            waiting = await unit.chat.get(result.conversation.id)
        assert waiting is not None
        assert waiting.messages[-1].content == (
            "Владелец отеля ответил на ваш вопрос: «Во всех номерах установлены плотные шторы блэкаут.»"
        )
        loaded = await card(hotel_id)
        assert any(
            f.characteristic_key == "blackout_curtains" and f.value is True for f in loaded.facts
        )
        again = await chat.send(
            result.conversation.id, "Есть ли в номерах шторы блэкаут?", region, hotel_id
        )
        assert again.conversation.messages[-1].content.startswith("Ответ владельца отеля от ")
        async with work() as unit:
            assert len(await unit.questions.for_hotel(hotel_id)) == 1
        search.assert_not_awaited()
    finally:
        await work.aclose()
