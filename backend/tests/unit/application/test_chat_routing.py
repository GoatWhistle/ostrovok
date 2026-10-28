import json
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.room_records import RoomRecord
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard, HotelCard
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.errors import HotelNotFound, ModelFailure
from hotel_agent.domain.query import ParsedQuery
from tests.unit.application.test_chat_conversations import FakeChatRepository, FakeUnitOfWork
from tests.unit.application.test_research_tools import HOTEL


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def build(registry: YamlCharacteristicRegistry, llm: Any = None) -> SimpleNamespace:
    repository = FakeChatRepository()
    search = AsyncMock(
        return_value=SearchOutcome(
            query_id="q",
            parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
            results=(),
        )
    )
    card = AsyncMock(
        return_value=HotelCard(
            hotel=HOTEL,
            rooms=(
                RoomRecord(
                    id="r1",
                    name="Двухместный",
                    capacity=2,
                    floor_min=None,
                    floor_max=None,
                    facade_ids=(),
                    price_amount=None,
                    price_currency=None,
                    included=(),
                ),
            ),
            facts=(),
            supplier_content=None,
        )
    )
    llm = llm or FakeLLM(registry)
    chat = Chat(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, lambda: FakeUnitOfWork(repository, [])),
        cast(SearchHotels, search),
        lambda r, took_ms: {"query_id": r.query_id},
        registry,
        cast(GetHotelCard, card),
    )
    return SimpleNamespace(chat=chat, repository=repository, search=search, card=card, llm=llm)


@pytest.mark.parametrize(
    "message",
    [
        "Привет",
        "Спасибо",
        "Что значит полупансион?",
        "Когда лучше ехать в Сочи?",
        "Как выбрать номер?",
        "Что посмотреть в Казани?",
        "Как найти отель?",
        "Не ищи отели пока",
        "Hello",
        "How do I find a hotel?",
        "Казань",
    ],
)
async def test_consultation_does_not_search_or_create_search_conditions(
    registry: YamlCharacteristicRegistry, message: str
) -> None:
    h = build(registry)
    result = await h.chat.send(None, message, "russia", None)
    assert result.search is None and result.search_snapshot is None
    assert result.conversation.effective_query is None
    assert len(result.conversation.messages) == 2
    h.search.assert_not_awaited()
    h.card.assert_not_awaited()


@pytest.mark.parametrize(
    "message",
    ["Найди отель в Сочи", "Хочу отель в Сочи", "Нужен номер на двоих", "Find a hotel in Sochi"],
)
async def test_explicit_search_runs_once(
    registry: YamlCharacteristicRegistry, message: str
) -> None:
    h = build(registry)
    result = await h.chat.send(None, message, "russia", None)
    assert result.search is not None
    h.search.assert_awaited_once()
    assert result.conversation.effective_query == message
    assert result.search_snapshot is not None
    assert result.search_snapshot["_chat_message_id"] == result.conversation.messages[-1].id


async def test_advice_preserves_search_snapshot_query_and_search_message(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    found = await h.chat.send(None, "Найди отель в Сочи", "russia", None)
    advice = await h.chat.send(found.conversation.id, "Когда лучше ехать в Сочи?", "russia", None)
    assert advice.search is None and advice.search_snapshot == found.search_snapshot
    assert advice.conversation.effective_query == found.conversation.effective_query
    updated = await h.chat.send(found.conversation.id, "а теперь в Казани", "russia", None)
    assert updated.search is not None and h.search.await_count == 2
    query = h.search.call_args.args[0]
    assert "Казани" in query and "Когда лучше" not in query


async def test_answer_to_pending_city_question_resumes_search(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    h.search.return_value = SearchOutcome(
        query_id="q",
        parsed=ParsedQuery(
            intents=(), unmatched_terms=(), location_hint=None, needs_clarification=True
        ),
        results=(),
    )
    initial = await h.chat.send(None, "Найди отель", "russia", None)
    assert "В каком городе" in initial.conversation.messages[-1].content
    await h.chat.send(initial.conversation.id, "Казань", "russia", None)
    assert h.search.await_count == 2 and "Казань" in h.search.call_args.args[0]


async def test_selected_hotel_advice_uses_current_card_without_search(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    result = await h.chat.send(None, "Какие у него номера?", "russia", HOTEL.id)
    h.card.assert_awaited_once_with(HOTEL.id)
    h.search.assert_not_awaited()
    reply = result.conversation.messages[-1].content
    assert HOTEL.name in reply and "Двухместный" in reply
    assert "не подтверждает наличие" in reply


async def test_selected_hotel_does_not_prevent_search_for_alternatives(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    await h.chat.send(None, "Найди другой отель в Казани", "russia", HOTEL.id)
    h.search.assert_awaited_once()


async def test_stale_selection_does_not_fabricate_another_hotel(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    h.card.side_effect = HotelNotFound()
    result = await h.chat.send(None, "У него есть парковка?", "russia", "missing")
    assert "недоступны" in result.conversation.messages[-1].content
    h.search.assert_not_awaited()


async def test_history_loading_never_starts_a_legacy_search(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    h.repository.conversations["legacy"] = ConversationRecord(
        id="legacy", region_id="russia", effective_query="Найди отель в Сочи", messages=()
    )
    result = await h.chat.get("legacy")
    assert result.search is None
    h.search.assert_not_awaited()


async def test_routing_failure_fails_closed_and_preserves_results(
    registry: YamlCharacteristicRegistry,
) -> None:
    h = build(registry)
    found = await h.chat.send(None, "Найди отель в Сочи", "russia", None)
    h.chat._dialogue._llm = cast(
        LLMPort, SimpleNamespace(respond_to_chat=AsyncMock(side_effect=ModelFailure()))
    )
    result = await h.chat.send(found.conversation.id, "Привет", "russia", None)
    assert result.search is None and result.search_snapshot == found.search_snapshot
    assert h.search.await_count == 1


async def test_card_switch_replaces_factual_context_and_does_not_use_history_as_facts(
    registry: YamlCharacteristicRegistry,
) -> None:
    llm = SimpleNamespace(
        respond_to_chat=AsyncMock(
            return_value=ChatDecision(ChatMode.HOTEL, reply="Данных о парковке нет.")
        )
    )
    h = build(registry, llm)
    first = await h.chat.send(None, "Есть парковка?", "russia", HOTEL.id)
    h.card.return_value = replace(h.card.return_value, hotel=replace(HOTEL, id="h2", name="Второй"))
    await h.chat.send(first.conversation.id, "А у этого?", "russia", "h2")
    context = json.loads(llm.respond_to_chat.call_args.args[0])
    assert context["selected_hotel"]["id"] == "h2"
    assert context["selected_hotel"]["name"] == "Второй"
    assert context["selected_hotel"]["availability_verified"] is False
    h.search.assert_not_awaited()
