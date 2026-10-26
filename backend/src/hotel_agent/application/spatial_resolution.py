from collections.abc import Sequence
from math import cos, radians
from statistics import median

from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.domain.query import SpatialRequest

type SpatialTarget = NamedPlaceRecord | tuple[float, float] | None


async def resolve_spatial_requests(
    uow: UnitOfWork,
    requests: Sequence[SpatialRequest],
    city: str,
    bbox: tuple[float, float, float, float] | None,
    hotels: Sequence[SearchHotelRecord],
) -> list[tuple[SpatialRequest, SpatialTarget]]:
    if not requests or not hotels:
        return []
    coordinates = [hotel.location for hotel in hotels]
    extent = bbox or (
        min(item[0] for item in coordinates) - 0.1,
        min(item[1] for item in coordinates) - 0.1,
        max(item[0] for item in coordinates) + 0.1,
        max(item[1] for item in coordinates) + 0.1,
    )
    resolved: list[tuple[SpatialRequest, SpatialTarget]] = []
    for request in requests:
        if request.kind == "sea_view":
            resolved.append((request, None))
            continue
        if request.kind == "city_center":
            center = await uow.regions.city_center(city)
            if center is None:
                center = (
                    median(item[0] for item in coordinates),
                    median(item[1] for item in coordinates),
                )
            resolved.append((request, center))
            continue
        target = request.target or ""
        place = await uow.named_places.by_name(
            target, extent, request.target_osm_key, request.target_osm_values
        )
        if place is None and request.kind == "landmark_view":
            latitude = (extent[1] + extent[3]) / 2
            dy = request.radius_m / 111200
            dx = dy / max(cos(radians(latitude)), 0.1)
            expanded = (extent[0] - dx, extent[1] - dy, extent[2] + dx, extent[3] + dy)
            place = await uow.named_places.by_name(
                target, expanded, request.target_osm_key, request.target_osm_values
            )
        resolved.append((request, place))
    return resolved
