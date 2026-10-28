from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.search_selection import select_candidates
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)


def hotel(identifier: str, name: str) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=identifier,
        region_id="sochi",
        name=name,
        location=(39.72, 43.58),
        stars=3,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def fact(hotel_id: str, key: str, value: object) -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id=hotel_id,
        id=f"f_{hotel_id}_{key}",
        characteristic_key=key,
        value=value,
        unit=None,
        qualifiers={},
        source_type="computed",
        source_id=None,
        method=f"{key}@1",
        confidence=0.8,
        computed_at=NOW - timedelta(days=1),
        valid_until=NOW + timedelta(days=100),
        status="active",
        geo_refs=(),
        explanation="",
        facade_azimuth=None,
        subject_id=hotel_id,
    )


def wanted(key: str, value: object, required: bool = True) -> Intent:
    return Intent(
        characteristic_key=key,
        op=Op.EQ,
        value=value,  # type: ignore[arg-type]
        weight=1.0,
        required=required,
        source_text=key,
    )


async def test_a_hotel_that_fails_a_requirement_says_which_one() -> None:
    parsed = ParsedQuery(
        intents=(wanted("pets_policy", True),), unmatched_terms=(), location_hint="Сочи"
    )
    explored = ExplorationOutcome(
        hotels=(hotel("h1", "Подходит"), hotel("h2", "Не подходит")),
        facts=(fact("h1", "pets_policy", True), fact("h2", "pets_policy", False)),
    )

    selection = await select_candidates("можно с собакой", parsed, explored, NOW, None, 20)

    assert [item[0].id for item in selection.accepted] == ["h1"]
    assert [(item.hotel.id, item.cause) for item in selection.rejected] == [
        ("h2", "requirement_unmet")
    ]
    assert selection.rejected[0].characteristic_key == "pets_policy"


async def test_an_unknown_value_does_not_reject_the_hotel() -> None:
    parsed = ParsedQuery(
        intents=(wanted("pets_policy", True),), unmatched_terms=(), location_hint="Сочи"
    )
    explored = ExplorationOutcome(hotels=(hotel("h1", "Неизвестно"),))

    selection = await select_candidates("можно с собакой", parsed, explored, NOW, None, 20)

    assert [item[0].id for item in selection.accepted] == ["h1"]
    assert selection.rejected == ()


async def test_the_closest_miss_comes_first() -> None:
    parsed = ParsedQuery(
        intents=(wanted("pets_policy", True), wanted("double_room", True, required=False)),
        unmatched_terms=(),
        location_hint="Сочи",
    )
    explored = ExplorationOutcome(
        hotels=(hotel("h1", "Совсем нет"), hotel("h2", "Почти")),
        facts=(
            fact("h1", "pets_policy", False),
            fact("h2", "pets_policy", False),
            fact("h2", "double_room", True),
        ),
    )

    selection = await select_candidates("можно с собакой", parsed, explored, NOW, None, 20)

    assert [item.hotel.id for item in selection.rejected] == ["h2", "h1"]
    assert selection.rejected[0].closeness > selection.rejected[1].closeness


async def test_without_conditions_nothing_is_rejected() -> None:
    explored = ExplorationOutcome(hotels=(hotel("h1", "Любой"),))

    selection = await select_candidates(
        "сочи",
        ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
        explored,
        NOW,
        None,
        20,
    )

    assert [item[0].id for item in selection.accepted] == ["h1"]
    assert selection.rejected == ()


async def test_a_required_condition_nobody_could_confirm_says_so() -> None:
    parsed = ParsedQuery(
        intents=(wanted("pets_policy", True),), unmatched_terms=(), location_hint="Сочи"
    )
    explored = ExplorationOutcome(hotels=(hotel("h1", "Неизвестно"),))
    review = SimpleNamespace(check=AsyncMock(return_value=ReviewResult(accepted_ids=())))

    selection = await select_candidates(
        "можно с собакой", parsed, explored, NOW, cast(RecommendationReview, review), 20
    )

    assert selection.accepted == ()
    assert [(item.cause, item.characteristic_key) for item in selection.rejected] == [
        ("requirement_unknown", "pets_policy")
    ]
