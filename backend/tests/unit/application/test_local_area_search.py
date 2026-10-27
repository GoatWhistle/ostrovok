from collections.abc import Sequence
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.application.dto import LocalAreaRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.search_candidates import find_candidates


def hotel(identifier: str, name: str, location: tuple[float, float]) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=identifier,
        region_id="sochi",
        name=name,
        location=location,
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def factory(local: LocalAreaRecord | None, hotels: Sequence[SearchHotelRecord]) -> SimpleNamespace:
    unit = SimpleNamespace(
        regions=SimpleNamespace(
            local_area=AsyncMock(return_value=local), city_bbox=AsyncMock(return_value=None)
        ),
        search=SimpleNamespace(list_hotels=AsyncMock(return_value=list(hotels))),
    )
    context = AsyncMock()
    context.__aenter__.return_value = unit
    return SimpleNamespace(unit=unit, factory=lambda: context)


DISTRICT = (39.864, 43.512)
NEAR = hotel("near", "Яблоко", (39.866, 43.513))
NEXT = hotel("next", "Абрис", (39.880, 43.520))
FAR = hotel("far", "Аида", (39.720, 43.590))


async def test_district_of_detailed_region_restricts_hotels_to_its_radius() -> None:
    fakes = factory(LocalAreaRecord(region_id="sochi", center=DISTRICT), [FAR, NEXT, NEAR])

    found = await find_candidates(
        "q", "Хоста", "russia", None, cast(UnitOfWorkFactory, fakes.factory), None, None
    )

    assert found.region == "sochi"
    assert not found.unsupported
    assert [item.id for item in found.hotels] == ["near", "next"]
    assert found.bbox is not None
    assert found.bbox[0] < DISTRICT[0] < found.bbox[2]
    fakes.unit.search.list_hotels.assert_awaited_once_with("sochi", None)
    fakes.unit.regions.city_bbox.assert_not_awaited()


async def test_empty_district_radius_keeps_region_hotels_nearest_first() -> None:
    fakes = factory(LocalAreaRecord(region_id="sochi", center=(39.95, 43.40)), [FAR, NEXT])

    found = await find_candidates(
        "q", "Сириус", "russia", None, cast(UnitOfWorkFactory, fakes.factory), None, None
    )

    assert found.region == "sochi"
    assert [item.id for item in found.hotels] == ["next", "far"]
    assert found.bbox is None


async def test_region_name_searches_the_whole_detailed_region() -> None:
    fakes = factory(LocalAreaRecord(region_id="sochi"), [FAR, NEAR])

    found = await find_candidates(
        "q", "Сочи", "russia", None, cast(UnitOfWorkFactory, fakes.factory), None, None
    )

    assert found.region == "sochi"
    assert found.bbox is None
    assert found.allow_expand
    assert [item.id for item in found.hotels] == ["far", "near"]
