from collections.abc import Callable, Sequence
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.spatial_matching import distance_m
from hotel_agent.domain.query import OSM_OBJECT_KEYS, NearbyObjectRequest

NOTE = (
    "Objects from the OpenStreetMap extract matched by name, brand, operator or cuisine."
    " An empty result means no such record in the data, not that the place does not exist."
    " Distance is straight-line within the radius, not a walking route."
    " When the object is found, finish with a criterion on the returned distance field and the"
    " threshold you consider right for the wish, instead of searching the internet for it."
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
        points = {
            str(row.osm_ref): tuple(row.geometry["coordinates"])
            for row in named
            if row.osm_ref and row.geometry.get("type") == "Point"
        }
        self._count += 1
        count_field, distance_field = f"place{self._count}.count", f"place{self._count}.distance_m"
        self.descriptions[count_field] = (
            f"Объектов «{name or key}» в радиусе {int(radius)} м по данным OpenStreetMap"
        )
        self.descriptions[distance_field] = (
            f"Расстояние до ближайшего объекта «{name or key}» по прямой, м"
        )
        measured = []
        for hotel in self._hotels():
            ids = matches.get(hotel.id, ())
            self.metrics.setdefault(hotel.id, {})[count_field] = float(len(ids))
            if not ids:
                continue
            self.geo_refs.setdefault(hotel.id, {})[count_field] = tuple(
                f"g_poi_{item}" for item in ids[:8]
            )
            distances = sorted(
                (round(distance_m(hotel.location, points[item]), 1), item)
                for item in ids
                if item in points
            )
            if distances:
                nearest, item = distances[0]
                self.metrics.setdefault(hotel.id, {})[distance_field] = nearest
                self.geo_refs.setdefault(hotel.id, {})[distance_field] = (f"g_poi_{item}",)
            measured.append(
                {
                    "hotel_id": hotel.id,
                    "hotel_name": hotel.name,
                    "count": len(ids),
                    "nearest_m": distances[0][0] if distances else None,
                    "names": [labels[item] for item in ids[:5] if item in labels],
                }
            )
        return {
            "fields": {
                count_field: self.descriptions[count_field],
                distance_field: self.descriptions[distance_field],
            },
            "field": count_field,
            "searched": name or key,
            "radius_m": int(radius),
            "hotels_with_match": len(measured),
            "matches": sorted(
                measured, key=lambda row: (row["nearest_m"] is None, row["nearest_m"] or 0)
            )[:12],
            "note": NOTE,
        }
