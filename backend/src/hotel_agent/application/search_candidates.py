from collections.abc import Sequence
from dataclasses import dataclass
from math import cos, radians

from hotel_agent.application.dto import LocalAreaRecord, SearchHotelRecord
from hotel_agent.application.geographic_extent import intersection
from hotel_agent.application.landmark_resolution import LandmarkResolver
from hotel_agent.application.local_area import area_around, nearest_first
from hotel_agent.application.ports.geographic_objects import GeographicObjectsPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.domain.query import NearbyObjectRequest, SpatialRequest

RUSSIA = (19.0, 41.0, 180.0, 82.0)


@dataclass(frozen=True, slots=True)
class Candidates:
    hotels: Sequence[SearchHotelRecord]
    region: str
    bbox: tuple[float, float, float, float] | None
    allow_expand: bool = False
    unsupported: bool = False
    location_hint: str | None = None


async def find_candidates(
    query: str,
    location: str | None,
    region: str,
    bbox: tuple[float, float, float, float] | None,
    uow_factory: UnitOfWorkFactory,
    areas: SearchAreasPort | None,
    semantic: SemanticSearchPort | None,
    place_lookup: PlaceLookupPort | None = None,
    geographic_objects: GeographicObjectsPort | None = None,
    landmarks: LandmarkResolver | None = None,
    location_request: SpatialRequest | None = None,
    nearby_request: NearbyObjectRequest | None = None,
) -> Candidates:
    if location is None:
        documents = await semantic.search(query, limit=200) if semantic else ()
        ids = tuple(dict.fromkeys(doc.hotel_id for doc in documents))
        async with uow_factory() as uow:
            hotels = await uow.search.by_ids(ids) if ids else ()
        if bbox:
            hotels = [
                h
                for h in hotels
                if bbox[0] <= h.location[0] <= bbox[2] and bbox[1] <= h.location[1] <= bbox[3]
            ]
        return Candidates(hotels, "russia", bbox)
    async with uow_factory() as uow:
        local = await uow.regions.local_area(location)
    if local is not None:
        return await _local_candidates(local, bbox, uow_factory)
    area = areas.resolve(location) if areas else None
    allow_expand = bbox is None and area is None
    inferred = None
    region = "russia"
    async with uow_factory() as uow:
        extent = area.bbox if area else await uow.regions.city_bbox(location)
    if extent is None:
        async with uow_factory() as uow:
            place = await uow.named_places.geographic_name(location)
        if place is None and nearby_request is not None:
            async with uow_factory() as uow:
                named = await uow.named_places.candidates(
                    location, RUSSIA, nearby_request.osm_key, (nearby_request.osm_value,)
                )
            place = named[0] if named else None
        if place is None and landmarks is not None and location_request is not None:
            resolution = await landmarks(location_request, "Россия", RUSSIA, None)
            place = resolution.place
        if place is not None and geographic_objects is not None:
            geometry = await geographic_objects.get(place.id)
            if geometry is not None:
                area = geometry.area(10000)
                extent = area.bbox
                inferred = place.name
                allow_expand = False
        position = place.location if place else None
        if position is None and place_lookup is not None:
            position = await place_lookup.coordinates(location, RUSSIA)
        if position is not None and extent is None:
            inferred = areas.region_at(position) if areas else None
            dy = 50000 / 111200
            dx = dy / max(cos(radians(position[1])), 0.1)
            extent = (position[0] - dx, position[1] - dy, position[0] + dx, position[1] + dy)
            allow_expand = False
    if extent is None:
        return Candidates((), region, bbox, unsupported=True)
    if bbox:
        bbox = intersection(bbox, extent)
        if bbox is None:
            return Candidates((), region, None)
    else:
        bbox = extent
    async with uow_factory() as uow:
        hotels = await uow.search.list_hotels(region, bbox)
    if area:
        hotels = [hotel for hotel in hotels if area.contains(hotel.location)]
    return Candidates(hotels, region, bbox, allow_expand, location_hint=inferred)


async def _local_candidates(
    local: LocalAreaRecord,
    bbox: tuple[float, float, float, float] | None,
    uow_factory: UnitOfWorkFactory,
) -> Candidates:
    async with uow_factory() as uow:
        hotels = await uow.search.list_hotels(local.region_id, bbox)
    if local.center is None:
        return Candidates(hotels, local.region_id, bbox, bbox is None)
    area = area_around(local.center, local.kind)
    ordered = nearest_first(hotels, area)
    inside = bool(ordered) and area.contains(ordered[0].location)
    return Candidates(ordered, local.region_id, area.bbox if inside else bbox)
