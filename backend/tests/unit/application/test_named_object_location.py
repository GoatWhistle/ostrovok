from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.domain.query import NearbyObjectRequest

AIRPORT = NamedPlaceRecord(
    id="p_sheremetyevo",
    name="Шереметьево",
    location=(37.41, 55.97),
    tags={"aeroway": "aerodrome"},
)
HOTEL = SearchHotelRecord(
    id="h1",
    region_id="russia",
    name="Шератон Шереметьево",
    location=(37.43, 55.96),
    stars=4,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)
REQUEST = NearbyObjectRequest(
    osm_key="aeroway",
    osm_value="aerodrome",
    open_24h=False,
    avoid=False,
    required=False,
    radius_m=5000,
    source_text="рядом с аэропортом Шереметьево",
    name="Шереметьево",
)


def factory(candidates: tuple[NamedPlaceRecord, ...]) -> tuple[UnitOfWorkFactory, SimpleNamespace]:
    places = SimpleNamespace(
        geographic_name=AsyncMock(return_value=None),
        candidates=AsyncMock(return_value=candidates),
    )
    search = SimpleNamespace(list_hotels=AsyncMock(return_value=[HOTEL]))
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            regions=SimpleNamespace(
                local_area=AsyncMock(return_value=None), city_bbox=AsyncMock(return_value=None)
            ),
            named_places=places,
            search=search,
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    return cast(UnitOfWorkFactory, lambda: scope), places


async def test_an_airport_name_locates_the_search_instead_of_failing_as_a_city() -> None:
    uow, places = factory((AIRPORT,))

    result = await find_candidates(
        "Отель рядом с аэропортом Шереметьево",
        "Шереметьево",
        "russia",
        None,
        uow,
        None,
        None,
        nearby_request=REQUEST,
    )

    assert not result.unsupported
    assert [hotel.id for hotel in result.hotels] == ["h1"]
    places.candidates.assert_awaited_once()
    assert places.candidates.await_args.args[0] == "Шереметьево"


async def test_an_unknown_name_without_a_matching_object_stays_unsupported() -> None:
    uow, _ = factory(())

    result = await find_candidates(
        "Отель в Несуществующем", "Несуществующий", "russia", None, uow, None, None
    )

    assert result.unsupported
