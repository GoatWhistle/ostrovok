from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.dto import BuildingRecord, SearchHotelRecord
from hotel_agent.application.use_cases.get_hotel_scene import GetHotelScene

HOTEL = SearchHotelRecord(
    id="hotel",
    region_id="russia",
    name="Hotel",
    location=(37.6, 55.7),
    stars=None,
    building_id="own",
    height_m=20,
    levels=6,
    footprint={
        "type": "Polygon",
        "coordinates": [[[37.6, 55.7], [37.601, 55.7], [37.601, 55.701], [37.6, 55.7]]],
    },
)
NEIGHBOR = BuildingRecord(id="neighbor", geometry=HOTEL.footprint or {}, height_m=None, levels=None)


def dependencies() -> tuple[MagicMock, SimpleNamespace, SimpleNamespace]:
    search = SimpleNamespace(
        get_hotel=AsyncMock(return_value=HOTEL),
        list_facades=AsyncMock(return_value=[]),
        list_context_buildings=AsyncMock(return_value=[NEIGHBOR]),
    )
    unit = MagicMock()
    unit.__aenter__ = AsyncMock(return_value=SimpleNamespace(search=search))
    unit.__aexit__ = AsyncMock()
    factory = MagicMock(return_value=unit)
    geography = SimpleNamespace(area=AsyncMock())
    return factory, search, geography


async def test_existing_scene_returns_without_waiting_for_external_api() -> None:
    factory, _, geography = dependencies()
    scene = await GetHotelScene(factory, geography)(HOTEL.id, 500)
    assert scene.hotel == HOTEL and scene.context_buildings == (NEIGHBOR,)
    geography.area.assert_not_awaited()
    factory.assert_called_once()


async def test_missing_scene_is_downloaded_outside_transaction_and_read_again() -> None:
    factory, search, geography = dependencies()
    search.get_hotel.side_effect = [replace(HOTEL, footprint=None, building_id=None), HOTEL]
    search.list_context_buildings.side_effect = [[], [NEIGHBOR]]
    scene = await GetHotelScene(factory, geography)(HOTEL.id, 500)
    assert scene.hotel == HOTEL and scene.context_buildings == (NEIGHBOR,)
    geography.area.assert_awaited_once()
    assert factory.call_count == 2
