import re
from collections.abc import Sequence

from hotel_agent.application.dto import GeoFeatureRecord
from hotel_agent.application.ports.walk import PlaceWalk

WALK_REF = re.compile(r"^g_walk_([nwr]\d+)_([nwr]\d+)$")


def parse_walk_ref(value: str) -> tuple[str, str] | None:
    match = WALK_REF.fullmatch(value)
    return (match[1], match[2]) if match else None


def nearby_walk_refs(hotel_id: str, place_ids: Sequence[str]) -> tuple[str, ...]:
    refs = (f"g_walk_{hotel_id}_{place_id}" for place_id in place_ids[:5])
    return tuple(ref for ref in refs if parse_walk_ref(ref) is not None)


def walk_feature(path: PlaceWalk) -> GeoFeatureRecord:
    return GeoFeatureRecord(
        id=f"g_walk_{path.hotel_id}_{path.place_id}",
        kind="route",
        characteristic_key="nearby",
        geometry=path.geometry,
        name=None,
        label=f"{path.meters:g} м, {path.minutes:g} мин"
        if path.minutes is not None
        else f"по прямой ~{path.meters:g} м",
        osm_ref=path.place_id,
        style_hint="line",
        properties={
            "place_id": path.place_id,
            "hotel_id": path.hotel_id,
            "distance_m": path.meters,
            "minutes": path.minutes,
            "mode": path.mode,
        },
    )
