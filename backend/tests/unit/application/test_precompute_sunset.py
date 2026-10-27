from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.dto import FacadeRecord, SearchFactRecord, SearchHotelRecord
from hotel_agent.application.room_records import RoomRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.use_cases.precompute_sunset import PrecomputeSunset

NOW = datetime(2026, 10, 27, tzinfo=UTC)


def hotel(levels: int | None = 9) -> SearchHotelRecord:
    return SearchHotelRecord(
        id="h1",
        region_id="sochi",
        name="Прибой",
        location=(39.73, 43.59),
        stars=None,
        building_id="b1",
        height_m=None,
        levels=levels,
        footprint=None,
    )


def facade(azimuth: float) -> FacadeRecord:
    return FacadeRecord(id=f"f{azimuth}", azimuth_deg=azimuth, label="", geometry={})


def build(
    facades: list[FacadeRecord],
    measured: dict[str, dict[str, float]],
    levels: int | None = 9,
    rooms: list[RoomRecord] | None = None,
) -> tuple[PrecomputeSunset, list[SearchFactRecord]]:
    saved: list[SearchFactRecord] = []
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            search=SimpleNamespace(
                list_hotels=AsyncMock(return_value=[hotel(levels)]),
                list_facts=AsyncMock(return_value=[]),
                list_facades=AsyncMock(return_value=facades),
                list_rooms=AsyncMock(return_value=rooms or []),
            ),
            facts=SimpleNamespace(save=AsyncMock(side_effect=lambda rows: saved.extend(rows))),
            commit=AsyncMock(),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    views = SimpleNamespace(assess=AsyncMock(return_value=measured))
    use_case = PrecomputeSunset(
        cast(UnitOfWorkFactory, lambda: scope),
        cast(ViewAssessmentPort, views),
        cast(ClockPort, SimpleNamespace(now=lambda: NOW)),
    )
    return use_case, saved


async def test_an_open_western_facade_sees_the_sunset_from_a_low_floor() -> None:
    use_case, saved = build(
        [facade(290.0)], {"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": 14.0}}
    )

    assert await use_case("sochi") == 1
    fact = saved[0]
    assert fact.value is True
    assert fact.qualifiers["from_floor"] == 2
    assert fact.qualifiers["facades_facing_sunset"] == 1
    assert "апрель — август" in fact.explanation


async def test_a_ridge_above_the_building_leaves_the_sunset_unreachable() -> None:
    use_case, saved = build(
        [facade(290.0)], {"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": 70.0}}
    )

    assert await use_case("sochi") == 1
    assert saved[0].value is False
    assert saved[0].qualifiers["from_floor"] == 21


async def test_a_building_without_a_western_facade_cannot_see_the_sunset() -> None:
    use_case, saved = build([facade(90.0)], {})

    assert await use_case("sochi") == 1
    assert saved[0].value is False
    assert saved[0].qualifiers["facades_facing_sunset"] == 0
    assert "Ни один фасад" in saved[0].explanation


async def test_an_unknown_height_leaves_the_wish_unknown_with_the_floor_named() -> None:
    use_case, saved = build(
        [facade(290.0)],
        {"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": 24.0}},
        levels=None,
    )

    assert await use_case("sochi") == 1
    fact = saved[0]
    assert fact.value is None
    assert fact.qualifiers["from_floor"] == 5
    assert "Этажность здания неизвестна" in fact.explanation


def room(floor_min: int | None, floor_max: int | None) -> RoomRecord:
    return RoomRecord(
        id="r1",
        name="Номер с видом",
        capacity=2,
        floor_min=floor_min,
        floor_max=floor_max,
        facade_ids=(),
        price_amount=None,
        price_currency=None,
        included=(),
    )


async def test_a_room_on_the_required_floor_confirms_the_estimate() -> None:
    use_case, saved = build(
        [facade(290.0)],
        {"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": 24.0}},
        rooms=[room(4, 7)],
    )

    await use_case("sochi")

    assert saved[0].qualifiers["from_floor"] == 5
    assert saved[0].qualifiers["bookable_room_confirmed"] is True
    assert saved[0].qualifiers["rooms_with_known_floor"] == 1


async def test_a_room_without_a_floor_leaves_the_estimate_unconfirmed() -> None:
    use_case, saved = build(
        [facade(290.0)],
        {"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": 24.0}},
        rooms=[room(None, None)],
    )

    await use_case("sochi")

    assert saved[0].qualifiers["bookable_room_confirmed"] is False
    assert saved[0].qualifiers["rooms_with_known_floor"] == 0


async def test_a_hotel_with_a_rechecked_version_is_left_alone() -> None:
    use_case, saved = build(
        [facade(290.0)], {"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": 14.0}}
    )
    scope = use_case._uow()
    scope.__aenter__.return_value.search.list_facts = AsyncMock(
        return_value=[
            SearchFactRecord(
                hotel_id="h1",
                id="f_sunset_view_h1_r20261027204806",
                characteristic_key="sunset_view",
                value=True,
                unit=None,
                qualifiers={},
                source_type="computed",
                source_id=None,
                method="sunset_view@1",
                confidence=0.75,
                computed_at=NOW,
                valid_until=None,
                status="active",
                geo_refs=(),
                explanation="",
                facade_azimuth=None,
                subject_id="h1",
            )
        ]
    )

    assert await use_case("sochi") == 0
    assert saved == []
