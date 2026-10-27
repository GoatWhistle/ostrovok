from collections.abc import Sequence
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from hotel_agent.adapters.geo.geographic_objects import GeographicObjects
from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.ports.view_geometry import PhysicalObject
from hotel_agent.application.search_candidates import find_candidates


def hotel(identifier: str, position: tuple[float, float]) -> SearchHotelRecord:
    return SearchHotelRecord(
        region_id="russia",
        id=identifier,
        name=identifier,
        location=position,
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


@pytest.mark.asyncio
async def test_natural_object_search_uses_full_shape_without_selecting_one_region() -> None:
    hotels = [
        hotel("south", (103.999, 51.01)),
        hotel("north", (105.001, 55.99)),
        hotel("inland", (108, 54)),
    ]

    async def listed(
        region: str, bbox: tuple[float, float, float, float]
    ) -> Sequence[SearchHotelRecord]:
        assert region == "russia"
        assert bbox[1] < 51 and bbox[3] > 56
        return hotels

    unit = SimpleNamespace(
        regions=SimpleNamespace(
            city_bbox=AsyncMock(return_value=None), local_area=AsyncMock(return_value=None)
        ),
        named_places=SimpleNamespace(
            geographic_name=AsyncMock(
                return_value=NamedPlaceRecord(id="r1", name="Long Lake", location=(104.5, 53.5))
            )
        ),
        search=SimpleNamespace(list_hotels=listed),
    )
    context = AsyncMock()
    context.__aenter__.return_value = unit
    geometry = AsyncMock()
    geometry.object.return_value = PhysicalObject(
        "r1",
        {"natural": "water"},
        {
            "type": "Polygon",
            "coordinates": [[[104, 51], [105, 51], [105, 56], [104, 56], [104, 51]]],
        },
        "local:osm",
    )
    result = await find_candidates(
        "hotel on Long Lake",
        "Long Lake",
        "russia",
        None,
        lambda: context,
        None,
        None,
        geographic_objects=GeographicObjects(geometry),
    )
    assert {h.id for h in result.hotels} == {"north", "south"}
    assert result.location_hint == "Long Lake"
    assert result.allow_expand is False
