import hashlib
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.walk_refs import nearby_walk_refs
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, NearbyObjectRequest


def nearby_key(request: NearbyObjectRequest) -> str:
    base = (
        f"nearby:{request.osm_key}:{request.osm_value}:{request.name.casefold()}"
        f":{int(request.open_24h)}:{request.radius_m}"
    )
    return f"{base}:avoid" if request.avoid else base


def nearby_intent(request: NearbyObjectRequest) -> Intent:
    return Intent(
        characteristic_key=nearby_key(request),
        op=Op.LTE if request.avoid else Op.GTE,
        value=0.0 if request.avoid else 1.0,
        weight=1.0,
        required=request.required,
        source_text=request.source_text,
    )


def nearby_record(
    hotel_id: str,
    key: str,
    request: NearbyObjectRequest,
    ids: Sequence[str],
    now: datetime,
    names: Mapping[str, str] | None = None,
) -> SearchFactRecord:
    labels = names or {}
    found = tuple(dict.fromkeys(labels[item] for item in ids if labels.get(item)))
    digest = hashlib.sha256(key.encode()).hexdigest()[:10]
    return SearchFactRecord(
        hotel_id=hotel_id,
        id=f"f_near_{hotel_id}_{digest}",
        characteristic_key=key,
        value=len(ids),
        unit="count",
        qualifiers={
            "source_text": request.source_text,
            **({"estimated_absence": True} if request.avoid else {}),
            **({"nearby_names": list(found[:8])} if found else {}),
        },
        source_type="computed",
        source_id=None,
        method="nearby_objects@1",
        confidence=0.7,
        computed_at=now,
        valid_until=now + timedelta(days=30),
        status="active",
        geo_refs=(
            *(f"g_poi_{item}" for item in ids),
            *nearby_walk_refs(hotel_id, ids),
        ),
        explanation=(
            f"По неполным данным OpenStreetMap в радиусе {request.radius_m} м найдено "
            f"{len(ids)} объектов; отсутствие не гарантировано."
            if request.avoid
            else (
                f"Объекты OpenStreetMap «{request.name}» в радиусе {request.radius_m} м"
                if request.name
                else f"Объекты OpenStreetMap в радиусе {request.radius_m} м"
            )
            + (" с тегом opening_hours=24/7" if request.open_24h else "")
            + (
                ": "
                + ", ".join(f"«{name}»" for name in found[:3])
                + (f" и ещё {len(found) - 3}" if len(found) > 3 else "")
                if found
                else "; названий у найденных объектов в данных нет"
            )
        ),
        facade_azimuth=None,
    )
