from dataclasses import replace
from datetime import datetime

from hotel_agent.application.dto import (
    GeoFeatureRecord,
    NamedPlaceRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.ports.geographic_objects import GeographicObject
from hotel_agent.application.spatial_matching import spatial_fact
from hotel_agent.domain.query import SpatialRequest


def geographic_distance(
    request: SpatialRequest,
    hotel: SearchHotelRecord,
    target: NamedPlaceRecord,
    geometry: GeographicObject,
    now: datetime,
) -> tuple[SearchFactRecord, GeoFeatureRecord]:
    nearest = geometry.nearest(hotel.location)
    fact = spatial_fact(request, hotel, replace(target, location=nearest), now)
    reference = f"g_boundary_{fact.id}"
    fact = replace(
        fact,
        method="geographic_boundary_distance@1",
        qualifiers={**fact.qualifiers, "target_id": target.id, "target_location": list(nearest)},
        geo_refs=(reference,),
        explanation=f"До ближайшей точки контура «{target.name}» {fact.value} м по прямой. "
        "Расстояние рассчитано по геометрии объекта OpenStreetMap; это не пеший маршрут.",
    )
    feature = GeoFeatureRecord(
        id=reference,
        kind="route",
        characteristic_key=fact.characteristic_key,
        geometry={"type": "LineString", "coordinates": [list(hotel.location), list(nearest)]},
        name=target.name,
        label=f"{fact.value} м по прямой",
        osm_ref=target.id,
        style_hint="walk_route",
    )
    return fact, feature
