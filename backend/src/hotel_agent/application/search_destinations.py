import asyncio
from collections.abc import Mapping, Sequence

from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.ports.geographic_objects import GeographicObject, GeographicObjectsPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.spatial_resolution import resolve_spatial_requests
from hotel_agent.domain.query import NearbyObjectRequest, ParsedQuery, SpatialRequest

type Destinations = tuple[
    NearbyObjectRequest | SpatialRequest,
    Mapping[str, tuple[str, ...]],
    dict[str, NamedPlaceRecord],
    dict[str, GeographicObject],
]


async def destinations(
    parsed: ParsedQuery,
    hotels: Sequence[SearchHotelRecord],
    region: str,
    bbox: tuple[float, float, float, float] | None,
    factory: UnitOfWorkFactory,
    geographic: GeographicObjectsPort | None,
) -> Destinations | None:
    nearby = next((r for r in parsed.nearby_objects if not r.avoid), None)
    spatial = next((r for r in parsed.spatial_requests if r.kind == "landmark_nearby"), None)
    request = nearby or spatial
    if request is None:
        return None
    places: dict[str, NamedPlaceRecord] = {}
    matches: Mapping[str, tuple[str, ...]] = {}
    async with factory() as uow:
        if nearby:
            matches = await uow.nearby_objects.list_matches(region, nearby, bbox)
            ids = {id for h in hotels for id in matches.get(h.id, ())}
            features = (
                await uow.geo_features.get_batch(sorted(f"g_poi_{id}" for id in ids)) if ids else ()
            )
            for feature in features:
                coordinates = feature.geometry.get("coordinates")
                if feature.geometry.get("type") == "Point" and isinstance(
                    coordinates, list | tuple
                ):
                    id = str(feature.osm_ref)
                    places[id] = NamedPlaceRecord(
                        id=id,
                        name=feature.name or "",
                        location=(float(coordinates[0]), float(coordinates[1])),
                    )
        elif spatial:
            resolved = await resolve_spatial_requests(
                uow, (spatial,), parsed.location_hint or region, bbox, hotels
            )
            for _, target in resolved:
                if isinstance(target, NamedPlaceRecord):
                    places[target.id] = target
                    matches = {h.id: (target.id,) for h in hotels}
    shapes: dict[str, GeographicObject] = {}
    if geographic and (
        spatial
        or (
            nearby
            and nearby.osm_key in {"name", "place", "highway", "waterway", "natural", "leisure"}
        )
    ):
        gate = asyncio.Semaphore(4)

        async def load(id: str) -> None:
            async with gate:
                shape = await geographic.get(id)
                if shape is not None:
                    shapes[id] = shape

        async with asyncio.TaskGroup() as group:
            for id in places:
                if id.startswith(("w", "r")):
                    group.create_task(load(id))
    return request, matches, places, shapes
