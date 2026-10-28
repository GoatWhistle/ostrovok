from dataclasses import replace
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.exploration_requests import apply_exploration
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import (
    SearchHotels,
    SearchOutcome,
    SearchResult,
)
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality, PropertyMatch, Scored


def chat(search: Any = None, uow: Any = None) -> Chat:
    return Chat(
        cast(LLMPort, SimpleNamespace()),
        cast(UnitOfWorkFactory, uow),
        cast(SearchHotels, search),
        lambda outcome, took_ms: {"query_id": outcome.query_id},
        cast(CharacteristicRegistryPort, SimpleNamespace()),
    )


def outcome(parsed: ParsedQuery) -> SearchOutcome:
    return SearchOutcome(query_id="test", parsed=parsed, results=())


def test_missing_tool_matches_do_not_claim_query_conditions_are_contradictory() -> None:
    parsed = ParsedQuery(
        intents=(), unmatched_terms=("с рестораном",), location_hint="Новороссийск"
    )
    explored = ExplorationOutcome(hotels=(), question="Уточнить область поиска?")

    result = apply_exploration(parsed, explored)

    assert not result.needs_clarification
    answer = chat()._answer(
        SearchOutcome(query_id="test", parsed=result, results=(), question=explored.question),
        None,
        "ru",
    )
    assert answer.startswith("Уточнить область поиска?")
    assert "противореч" not in answer


def test_room_request_asks_for_missing_dates_and_guests() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи", wants_room=True)
    answer = chat()._answer(outcome(parsed), None, "ru")
    assert "дату заезда" in answer
    assert "дату выезда" in answer
    assert "число взрослых" in answer


def test_room_request_does_not_ask_when_stay_is_complete() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи", wants_room=True)
    parsed = replace(
        parsed,
        check_in=date(2026, 11, 1),
        check_out=date(2026, 11, 2),
        adults=2,
        budget="до 5000 рублей за ночь",
    )
    answer = chat()._answer(outcome(parsed), None, "ru")
    assert "Чтобы проверить свободные номера" not in answer


def test_unverified_conditions_are_named_in_answer() -> None:
    parsed = ParsedQuery(
        intents=(),
        unmatched_terms=("бассейн", "шведский стол"),
        location_hint="Сочи",
    )
    answer = chat()._answer(outcome(parsed), None, "ru")
    assert "Не смог проверить: бассейн, шведский стол" in answer
    assert "не учтены в подборке" in answer


def test_partial_recommendations_are_not_described_as_complete() -> None:
    wanted = Intent(
        characteristic_key="room_capacity",
        op=Op.GTE,
        value=4.0,
        weight=1.0,
        required=True,
        source_text="на четверых",
    )
    parsed = ParsedQuery(intents=(wanted,), unmatched_terms=(), location_hint="Сочи")
    hotel = SearchHotelRecord(
        id="hotel-1",
        region_id="sochi",
        name="Пример",
        location=(39.7, 43.5),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    result = SearchResult(
        hotel=hotel,
        scored=Scored(
            score=0.5,
            matches=(PropertyMatch(intent=wanted, fact=None, quality=MatchQuality.UNKNOWN),),
            disqualified=False,
        ),
    )

    answer = chat()._answer(
        SearchOutcome(query_id="test", parsed=parsed, results=(result,)), None, "ru"
    )

    assert "Ни у одного отеля не подтверждены все условия" in answer


def test_chat_asks_for_city_before_room_details() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint=None, wants_room=True)

    assert chat()._answer(outcome(parsed), None, "ru") == "В каком городе ищете отель?"


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


def test_explicit_waiver_skips_room_questions_but_anywhere_alone_does_not() -> None:
    parsed = ParsedQuery(
        intents=(), unmatched_terms=(), location_hint=None, anywhere=True, wants_room=True
    )
    answer = chat()._answer(outcome(parsed), None, "ru")
    assert "бюджет" in answer and "число взрослых" in answer
    waived = replace(parsed, room_preferences_unrestricted=True)
    answer = chat()._answer(outcome(waived), None, "ru")
    assert "Чтобы проверить свободные номера" not in answer
