from dataclasses import replace
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.agent.wish_evidence import native_facts, unresolved_facts, wish_intent
from hotel_agent.application.agent.wish_records import WishResult, WishStatus
from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.exploration_requests import exploration_terms
from hotel_agent.application.ports.requested_evidence import (
    RequestedEvidence,
    RequestedEvidencePort,
)
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality
from tests.unit.application.test_city_search import search
from tests.unit.application.test_data_explorer import NOW, build, hotel


def record(key: str, value: bool | float | None, hotel_id: str = "city") -> SearchFactRecord:
    row = unresolved_facts(
        WishResult("wish", WishStatus.INCOMPLETE, "", 0, ()), [hotel(hotel_id)], NOW
    )[0]
    return replace(
        row,
        characteristic_key=key,
        value=value,
        confidence=0.95,
        qualifiers={},
        explanation=f"Source: {key}={value}",
    )


@pytest.mark.parametrize(
    ("capacity", "floor", "expected"),
    (
        (2, 10, True),
        (1, 10, False),
        (2, 2, False),
        (2, None, None),
    ),
)
def test_compound_wish_requires_all_native_conditions(
    capacity: int,
    floor: int | None,
    expected: bool | None,
) -> None:
    term = "двухместный на десятом этаже"
    intents = tuple(
        Intent(
            characteristic_key=key, op=Op.EQ, value=value, weight=1, required=True, source_text=term
        )
        for key, value in (("room_capacity", 2), ("room_floor", 10))
    )
    facts = [record("room_capacity", capacity)]
    if floor is not None:
        facts.append(record("room_floor", floor))
    result = native_facts(term, RequestedEvidence(intents, tuple(facts)), NOW)
    assert len(result) == 1
    assert result[0].value is expected


async def test_basic_known_wish_uses_database_evidence_without_a_planner_call() -> None:
    term = "двухместный"
    intent = Intent(
        characteristic_key="room_capacity",
        op=Op.EQ,
        value=2,
        weight=1,
        required=True,
        source_text=term,
    )
    native = SimpleNamespace(
        check=AsyncMock(
            return_value=RequestedEvidence(
                (intent,),
                (record("room_capacity", 2),),
            )
        )
    )
    explorer, llm, _ = build([])
    result = await explorer(
        "двухместный в Сочи",
        (term,),
        "Сочи",
        "sochi",
        [hotel("city")],
        None,
        False,
        native=cast(RequestedEvidencePort, native),
    )
    assert result.facts[0].value is True
    assert result.wish_results[0].tool_calls == 1
    llm.explore_data.assert_not_awaited()
    native.check.assert_awaited_once()


async def test_one_wish_question_keeps_hotels_matching_another_wish() -> None:
    first, second = "тихо", "свободный номер"
    use_case, _, repository, scope = search(
        ParsedQuery(intents=(), unmatched_terms=(first, second), location_hint="Москва"),
        (37.4, 55.5, 37.9, 56.0),
    )
    repository.save_facts = AsyncMock()
    scope.__aenter__.return_value.commit = AsyncMock()
    candidate = repository.list_hotels.return_value[0]
    outcomes = (
        WishResult(first, WishStatus.MATCHED, "Источник подтверждает.", 2, ("database",)),
        WishResult(second, WishStatus.NEEDS_INPUT, "Нужны даты.", 1, ()),
    )
    facts = tuple(
        replace(
            unresolved_facts(item, [candidate], NOW)[0],
            value=True if item.status is WishStatus.MATCHED else None,
            confidence=0.95,
        )
        for item in outcomes
    )
    outcome = ExplorationOutcome(
        hotels=(candidate,),
        intents=(wish_intent(first), wish_intent(second)),
        facts=facts,
        processed_terms=(first, second),
        question="На какие даты нужен номер?",
        wish_results=outcomes,
    )
    use_case._explorer = cast(DataExplorer, AsyncMock(return_value=outcome))
    result = await use_case("Москва, тихо, свободный номер", "russia", None, 20)
    assert len(result.results) == 1
    assert result.question == "На какие даты нужен номер?"
    assert [item.quality for item in result.results[0].scored.matches] == [
        MatchQuality.FULL,
        MatchQuality.UNKNOWN,
    ]
    repository.save_facts.assert_awaited_once()


def test_matching_facade_is_retained_when_another_facade_has_opposite_measurement() -> None:
    term = "тихо"
    intent = Intent(
        characteristic_key="noise_level",
        op=Op.LTE,
        value=40,
        weight=1,
        required=False,
        source_text=term,
    )
    quiet = replace(record("noise_level", 30), facade_azimuth=90)
    noisy = replace(record("noise_level", 70), facade_azimuth=270)
    result = native_facts(term, RequestedEvidence((intent,), (quiet, noisy)), NOW)
    assert result[0].value is True
    assert result[0].facade_azimuth == 90


def test_more_specific_wish_is_not_dropped_when_it_contains_a_basic_condition() -> None:
    parsed = ParsedQuery(
        intents=(),
        unmatched_terms=("с бассейном",),
        location_hint="Сочи",
        wishes=("с бассейном с морской водой",),
    )
    assert exploration_terms(parsed) == ("с бассейном", "с бассейном с морской водой")


def test_facade_within_requested_bound_wins_over_a_restricted_near_miss() -> None:
    term = "тихо"
    intent = Intent(
        characteristic_key="noise_level",
        op=Op.LTE,
        value=3,
        weight=1,
        required=False,
        source_text=term,
    )
    near_miss = replace(record("noise_level", 3.8), facade_azimuth=90)
    quiet = replace(record("noise_level", 0.5), facade_azimuth=270)
    result = native_facts(term, RequestedEvidence((intent,), (near_miss, quiet)), NOW)
    assert result[0].qualifiers["native_value"] == 0.5
    assert result[0].facade_azimuth == 270
    assert result[0].qualifiers["estimated_match"]


def test_a_threshold_stated_in_seconds_is_not_met_by_a_minute_measurement() -> None:
    term = "до моря не больше 3 секунд"
    intent = Intent(
        characteristic_key="distance_to_sea",
        op=Op.LTE,
        value=3.0,
        weight=1,
        required=False,
        source_text=term,
    )
    row = replace(record("distance_to_sea", 0.1), unit="min")
    evidence = RequestedEvidence(intents=(intent,), facts=(row,), features=())

    [fact] = native_facts(term, evidence, NOW)

    assert fact.value is False
    assert fact.qualifiers["native_threshold"] == 0.05
    assert fact.qualifiers["stated_threshold"] == 3.0


def test_a_threshold_already_in_minutes_still_matches() -> None:
    term = "до моря не больше 10 минут"
    intent = Intent(
        characteristic_key="distance_to_sea",
        op=Op.LTE,
        value=10.0,
        weight=1,
        required=False,
        source_text=term,
    )
    row = replace(record("distance_to_sea", 0.1), unit="min")
    evidence = RequestedEvidence(intents=(intent,), facts=(row,), features=())

    [fact] = native_facts(term, evidence, NOW)

    assert fact.value is True
    assert fact.qualifiers["native_threshold"] == 10.0
    assert "stated_threshold" not in fact.qualifiers
