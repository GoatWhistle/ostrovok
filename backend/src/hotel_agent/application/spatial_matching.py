import hashlib
from datetime import datetime, timedelta
from math import asin, cos, radians, sin, sqrt

from hotel_agent.application.dto import NamedPlaceRecord, SearchFactRecord, SearchHotelRecord
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, SpatialRequest


def spatial_key(request: SpatialRequest) -> str:
    identity = f"{request.kind}\x00{request.target or ''}\x00{request.source_text}"
    return f"spatial:{hashlib.sha256(identity.encode()).hexdigest()[:12]}"


def spatial_intent(request: SpatialRequest) -> Intent:
    return Intent(
        characteristic_key=spatial_key(request),
        op=Op.GTE if request.kind == "landmark_distance_min" else Op.LTE,
        value=float(request.radius_m),
        weight=1.0,
        required=request.required,
        source_text=request.source_text,
    )


def spatial_fact(
    request: SpatialRequest,
    hotel: SearchHotelRecord,
    target: NamedPlaceRecord | tuple[float, float],
    now: datetime,
) -> SearchFactRecord:
    position = target.location if isinstance(target, NamedPlaceRecord) else target
    name = target.name if isinstance(target, NamedPlaceRecord) else request.target or "ориентир"
    distance = distance_m(hotel.location, position)
    key = spatial_key(request)
    ref = (
        f"g_poi_{target.id}"
        if isinstance(target, NamedPlaceRecord)
        else f"g_point_{position[0]:.6f}_{position[1]:.6f}"
    )
    if request.kind == "city_center":
        explanation = (
            f"До приблизительного центра города {round(distance)} м по прямой. "
            "Ориентир рассчитан как медиана координат отелей с адресом в этом городе."
        )
        qualifiers = {"estimated_location": True}
    elif request.kind == "landmark_view":
        explanation = (
            f"До ориентира «{name}» {round(distance)} м по прямой. "
            "Вид из конкретного номера не подтверждён: неизвестны этаж, сторона и препятствия."
        )
        qualifiers = {"estimated_view": True}
    elif request.kind == "sea_view":
        explanation = (
            f"До ближайшей известной береговой линии {round(distance)} м по прямой. "
            "Вид на море из номера не подтверждён: неизвестны этаж, сторона и препятствия."
        )
        qualifiers = {"estimated_view": True}
    elif request.kind == "landmark_distance_min":
        explanation = (
            f"До ориентира «{name}» {round(distance)} м по прямой. "
            f"Минимальное расстояние в запросе — {request.radius_m} м."
        )
        qualifiers = {}
    else:
        explanation = f"До ориентира «{name}» {round(distance)} м по прямой."
        qualifiers = {}
    confidence = max(0.3, 0.8 * (1 - distance / max(request.radius_m * 3, 1)))
    return SearchFactRecord(
        hotel_id=hotel.id,
        id=f"f_spatial_{hotel.id}_{key.removeprefix('spatial:')}",
        characteristic_key=key,
        value=round(distance),
        unit="м",
        qualifiers=qualifiers,
        source_type="computed",
        source_id=target.id if isinstance(target, NamedPlaceRecord) else None,
        method="spatial_distance@1",
        confidence=confidence,
        computed_at=now,
        valid_until=now + timedelta(days=30),
        status="active",
        geo_refs=(ref,),
        explanation=explanation,
        facade_azimuth=None,
    )


def distance_m(first: tuple[float, float], second: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(radians, (*first, *second))
    latitude = sin((lat2 - lat1) / 2) ** 2
    longitude = cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 12_742_000 * asin(sqrt(latitude + longitude))
