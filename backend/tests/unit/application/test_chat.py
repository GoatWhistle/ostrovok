from dataclasses import replace
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.query import ParsedQuery


def chat(search: Any = None, uow: Any = None) -> Chat:
    return Chat(
        cast(LLMPort, SimpleNamespace()),
        cast(UnitOfWorkFactory, uow),
        cast(SearchHotels, search),
        lambda outcome: {"query_id": outcome.query_id},
    )


def outcome(parsed: ParsedQuery) -> SearchOutcome:
    return SearchOutcome(query_id="test", parsed=parsed, results=())


def test_room_request_asks_for_missing_dates_and_guests() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint=None, wants_room=True)
    answer = chat()._answer(outcome(parsed), None, "ru")
    assert "дату заезда" in answer
    assert "дату выезда" in answer
    assert "число взрослых" in answer


def test_room_request_does_not_ask_when_stay_is_complete() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint=None, wants_room=True)
    parsed = replace(parsed, check_in=date(2026, 11, 1), check_out=date(2026, 11, 2), adults=2)
    answer = chat()._answer(outcome(parsed), None, "ru")
    assert "Чтобы проверить свободные номера" not in answer


async def test_saved_conversation_uses_snapshot_without_search() -> None:
    record = ConversationRecord(
        id="test",
        region_id="sochi",
        effective_query="номер",
        messages=(),
        search_snapshot={"query_id": "saved"},
    )
    repository = SimpleNamespace(get=AsyncMock(return_value=record))
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(return_value=SimpleNamespace(chat=repository))
    scope.__aexit__ = AsyncMock(return_value=None)
    search = AsyncMock()

    result = await chat(search, lambda: scope).get("test")

    assert result.search_snapshot == {"query_id": "saved"}
    search.assert_not_awaited()
