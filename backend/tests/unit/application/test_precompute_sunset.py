from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.dto import FacadeRecord, SearchFactRecord, SearchHotelRecord
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
    facades: list[FacadeRecord], measured: dict[str, dict[str, float]], levels: int | None = 9
) -> tuple[PrecomputeSunset, list[SearchFactRecord]]:
    saved: list[SearchFactRecord] = []
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            search=SimpleNamespace(
                list_hotels=AsyncMock(return_value=[hotel(levels)]),
                list_facades=AsyncMock(return_value=facades),
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
