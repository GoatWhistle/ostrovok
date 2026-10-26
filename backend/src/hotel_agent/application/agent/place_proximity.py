from collections.abc import Callable, Sequence
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.query import OSM_OBJECT_KEYS, NearbyObjectRequest

NOTE = (
    "Objects from the OpenStreetMap extract matched by name, brand, operator or cuisine."
    " An empty result means no such record in the data, not that the place does not exist."
    " Distance is straight-line within the radius, not a walking route."
)


class PlaceProximity:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        region: str,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        bbox: Callable[[], tuple[float, float, float, float] | None],
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
        geo_refs: dict[str, dict[str, tuple[str, ...]]],
    ) -> None:
        self._uow, self._region, self._hotels, self._bbox = uow, region, hotels, bbox
        self.metrics, self.descriptions, self.geo_refs = metrics, descriptions, geo_refs
        self._count = 0

    async def find(self, arguments: dict[str, Any]) -> dict[str, Any]:
        name = str(arguments.get("name") or "").strip()
        key = str(arguments.get("osm_key") or "").strip() or None
        if not name and key is None:
            raise ValueError("Supply name and/or osm_key of the object to look for")
        if key is not None and key not in OSM_OBJECT_KEYS:
            raise ValueError(f"Supported osm_key values: {sorted(OSM_OBJECT_KEYS)}")
        radius = float(arguments.get("radius_m", 1000))
        if not 50 <= radius <= 20000:
            raise ValueError("Use a radius between 50 and 20000 m")
        request = NearbyObjectRequest(
            osm_key=key or "name",
            osm_value="*",
            open_24h=bool(arguments.get("open_24h", False)),
            radius_m=int(radius),
            source_text=name or str(key),
            name=name,
        )
        async with self._uow() as uow:
            matches = await uow.nearby_objects.list_matches(self._region, request, self._bbox())
            found = {item for ids in matches.values() for item in ids}
            named = (
                await uow.geo_features.get_batch(sorted(f"g_poi_{item}" for item in found))
                if found
                else ()
            )
        labels = {str(row.osm_ref): row.name for row in named if row.osm_ref and row.name}
        self._count += 1
        field = f"place{self._count}.count"
        self.descriptions[field] = (
            f"Объектов «{name or key}» в радиусе {int(radius)} м по данным OpenStreetMap"
        )
        measured = []
        for hotel in self._hotels():
            ids = matches.get(hotel.id, ())
            self.metrics.setdefault(hotel.id, {})[field] = float(len(ids))
            if ids:
                self.geo_refs.setdefault(hotel.id, {})[field] = tuple(
                    f"g_poi_{item}" for item in ids[:8]
                )
                measured.append(
                    {
                        "hotel_id": hotel.id,
                        "hotel_name": hotel.name,
                        "count": len(ids),
                        "names": [labels[item] for item in ids[:5] if item in labels],
                    }
                )
        return {
            "field": field,
            "searched": name or key,
            "radius_m": int(radius),
            "hotels_with_match": len(measured),
            "matches": sorted(measured, key=lambda row: -int(str(row["count"])))[:12],
            "note": NOTE,
        }
