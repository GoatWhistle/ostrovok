import hashlib
from collections.abc import Sequence
from datetime import datetime, timedelta

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, NearbyObjectRequest


def nearby_key(request: NearbyObjectRequest) -> str:
    return (
        f"nearby:{request.osm_key}:{request.osm_value}:{int(request.open_24h)}:{request.radius_m}"
    )


def nearby_intent(request: NearbyObjectRequest) -> Intent:
    return Intent(
        characteristic_key=nearby_key(request),
        op=Op.GTE,
        value=1.0,
        weight=1.0,
        required=False,
        source_text=request.source_text,
    )


def nearby_record(
    hotel_id: str,
    key: str,
    request: NearbyObjectRequest,
    ids: Sequence[str],
    now: datetime,
) -> SearchFactRecord:
    digest = hashlib.sha256(key.encode()).hexdigest()[:10]
    return SearchFactRecord(
        hotel_id=hotel_id,
        id=f"f_near_{hotel_id}_{digest}",
        characteristic_key=key,
        value=len(ids),
        unit="count",
        qualifiers={},
        source_type="computed",
        source_id=None,
        method="nearby_objects@1",
        confidence=0.7,
        computed_at=now,
        valid_until=now + timedelta(days=30),
        status="active",
        geo_refs=tuple(f"g_poi_{item}" for item in ids),
        explanation=(
            f"Объекты OpenStreetMap в радиусе {request.radius_m} м"
            + (" с тегом opening_hours=24/7" if request.open_24h else "")
        ),
        facade_azimuth=None,
    )
