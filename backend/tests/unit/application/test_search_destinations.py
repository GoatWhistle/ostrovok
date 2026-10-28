from dataclasses import replace
from typing import cast
from unittest.mock import AsyncMock, Mock

import pytest

from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.geographic_objects import GeographicObjectsPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.walk import PlaceWalk
from hotel_agent.application.search_preview import SearchPreview
from hotel_agent.domain.query import NearbyObjectRequest, ParsedQuery, SpatialRequest
from tests.unit.application.test_city_search import search


@pytest.mark.parametrize("term", ["Площадь искусств", "Набережная Дагомыса", "Музей"])
async def test_named_landmark_provides_a_route_to_its_known_geometry(term: str) -> None:
    request = SpatialRequest(kind="landmark_nearby", target=term, radius_m=500, source_text=term)
    parsed = ParsedQuery(
        intents=(), unmatched_terms=(), location_hint="Москва", spatial_requests=(request,)
    )
    _, _, repository, scope = search(parsed)
    hotel = repository.list_hotels.return_value[0]
    entered = scope.__aenter__.return_value
    entered.named_places.by_name = AsyncMock(
        return_value=NamedPlaceRecord(id="w1", name=term, location=(37.62, 55.75))
    )
    entered.walk = Mock(
        in_buildings=AsyncMock(return_value=()), to_points=AsyncMock(return_value=())
    )
    geometry = Mock(nearest=Mock(return_value=(37.6101, 55.75)))
    geographic = Mock(get=AsyncMock(return_value=geometry))
    preview = SearchPreview(cast(GeographicObjectsPort, geographic))
    await preview.calculate(parsed, [hotel], "russia", None, cast(UnitOfWorkFactory, lambda: scope))
    entered.walk.to_points.assert_awaited_once_with(hotel.id, {"w1": (37.6101, 55.75)}, 500)


async def test_avoidance_does_not_animate_approach_to_the_unwanted_object() -> None:
    request = NearbyObjectRequest(
        osm_key="amenity",
        osm_value="bar",
        open_24h=False,
        radius_m=500,
        source_text="без баров",
        avoid=True,
    )
    parsed = ParsedQuery(
        intents=(), unmatched_terms=(), location_hint="Москва", nearby_objects=(request,)
    )
    _, _, repository, scope = search(parsed)
    await SearchPreview().calculate(
        parsed,
        repository.list_hotels.return_value,
        "russia",
        None,
        cast(UnitOfWorkFactory, lambda: scope),
    )
    scope.__aenter__.assert_not_awaited()


async def test_onsite_hotels_do_not_exhaust_the_initial_walking_preview_budget() -> None:
    request = NearbyObjectRequest(
        osm_key="amenity", osm_value="bar", open_24h=False, radius_m=500, source_text="near bar"
    )
    parsed = ParsedQuery(
        intents=(), unmatched_terms=(), location_hint="Москва", nearby_objects=(request,)
    )
    _, _, repository, scope = search(parsed)
    base = repository.list_hotels.return_value[0]
    hotels = [replace(base, id=f"onsite{i}") for i in range(5)] + [replace(base, id="walking")]
    entered = scope.__aenter__.return_value
    entered.nearby_objects.list_matches = AsyncMock(return_value={h.id: ("bar",) for h in hotels})
    entered.walk = Mock(
        in_buildings=AsyncMock(
            return_value=[
                PlaceWalk(
                    hotel_id=h.id,
                    place_id="bar",
                    mode="onsite",
                    meters=0,
                    minutes=None,
                    geometry={"type": "Point", "coordinates": base.location},
                )
                for h in hotels[:-1]
            ]
        ),
        routes=AsyncMock(return_value=()),
    )
    await SearchPreview().calculate(
        parsed, hotels, "russia", None, cast(UnitOfWorkFactory, lambda: scope)
    )
    entered.walk.routes.assert_awaited_once_with("walking", ("bar",), 500)
