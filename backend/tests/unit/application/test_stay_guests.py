from dataclasses import replace

import pytest

from hotel_agent.application.stay_guests import guest_count, stay_guests
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality
from tests.unit.application.test_city_search import search
from tests.unit.application.test_wish_native_and_ranking import record


def capacity(text: str, value: float = 2.0) -> Intent:
    return Intent(
        characteristic_key="room_capacity",
        op=Op.GTE,
        value=value,
        weight=1.0,
        required=True,
        source_text=text,
    )


def derived(text: str) -> Intent:
    return Intent(
        characteristic_key="derived:guest",
        op=Op.EQ,
        value=True,
        weight=1.0,
        required=False,
        source_text=text,
    )


@pytest.mark.parametrize(
    ("text", "count"),
    (
        ("на двоих", 2),
        ("вдвоём", 2),
        ("for two adults", 2),
        ("3 взрослых", 3),
        ("на четверых", 4),
        ("2 adults", 2),
        ("тихий", None),
        ("гостиница у моря", None),
        ("two pools", None),
    ),
)
def test_guest_count_reads_only_guest_phrases(text: str, count: int | None) -> None:
    assert guest_count(text) == count


def test_guest_count_becomes_adults_and_leaves_research() -> None:
    parsed = ParsedQuery(
        intents=(derived("for two adults"), capacity("на двоих")),
        unmatched_terms=("вдвоём",),
        location_hint="Хоста",
        wishes=("на двоих", "тихий"),
    )

    cleaned = stay_guests(parsed)

    assert cleaned.adults == 2
    assert cleaned.intents == (capacity("на двоих"),)
    assert cleaned.wishes == ("тихий",)
    assert cleaned.unmatched_terms == ()


def test_unrelated_wishes_stay_untouched_without_guests() -> None:
    parsed = ParsedQuery(intents=(derived("тихий"),), unmatched_terms=(), location_hint="Сочи")
    assert stay_guests(parsed) == parsed


async def test_guest_capacity_without_catalog_facts_is_dropped_not_unknown() -> None:
    use_case, _, hotels, _ = search(
        ParsedQuery(intents=(capacity("на двоих"),), unmatched_terms=(), location_hint="Москва"),
        (37.4, 55.5, 37.9, 56.0),
    )

    result = await use_case("отель в Москве на двоих", "sochi", None, 20)

    assert result.parsed.adults == 2
    assert not result.parsed.intents
    assert len(result.results) == 1
    assert not result.results[0].scored.matches
    assert hotels.list_facts.await_args.kwargs["characteristic_keys"] == ["room_capacity"]


async def test_double_room_read_from_a_guest_count_is_dropped_without_facts() -> None:
    wanted = replace(capacity("на двоих"), characteristic_key="double_room", op=Op.EQ, value=True)
    use_case, _, hotels, _ = search(
        ParsedQuery(intents=(wanted,), unmatched_terms=(), location_hint="Москва"),
        (37.4, 55.5, 37.9, 56.0),
    )

    result = await use_case("тихий отель в Москве на двоих", "sochi", None, 20)

    assert result.parsed.adults == 2
    assert not result.parsed.intents
    assert hotels.list_facts.await_args.kwargs["characteristic_keys"] == ["double_room"]


async def test_guest_capacity_is_scored_on_a_real_catalog_fact() -> None:
    use_case, _, hotels, _ = search(
        ParsedQuery(intents=(capacity("на двоих"),), unmatched_terms=(), location_hint="Москва"),
        (37.4, 55.5, 37.9, 56.0),
    )
    hotels.list_facts.return_value = [replace(record("room_capacity", 3.0, "m1"))]

    result = await use_case("отель в Москве на двоих", "sochi", None, 20)

    assert [intent.characteristic_key for intent in result.parsed.intents] == ["room_capacity"]
    assert result.results[0].scored.matches[0].quality is MatchQuality.FULL
    assert hotels.list_facts.await_count == 1
