from collections.abc import Sequence
from math import cos, hypot, radians
from statistics import median
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class CandidateMeasurements:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        terrain: TerrainMeasurementPort,
        hotels: Sequence[SearchHotelRecord],
        city: str,
        region: str,
        bbox: tuple[float, float, float, float] | None,
        allow_expand: bool,
        country_scope: GeographicScopePort | None,
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
    ) -> None:
        self._uow, self._terrain = uow, terrain
        self.hotels = tuple(hotels)
        self.city, self.region, self.bbox = city, region, bbox
        self._allow_expand, self._country_scope = allow_expand, country_scope
        self.metrics, self.descriptions = metrics, descriptions
        self._measurements = 0

    def list(self, arguments: dict[str, Any]) -> dict[str, Any]:
        offset, limit = int(arguments.get("offset", 0)), int(arguments.get("limit", 12))
        if offset < 0 or not 1 <= limit <= 50:
            raise ValueError("Use a nonnegative offset and page size 1–50")
        selected = self.hotels[offset : offset + limit]
        return {
            "candidates": [
                {
                    "hotel_id": h.id,
                    "name": h.name,
                    "location": h.location,
                    "address": h.address,
                    "stars": h.stars,
                }
                for h in selected
            ],
            "total": len(self.hotels),
            "next_offset": offset + len(selected)
            if offset + len(selected) < len(self.hotels)
            else None,
        }

    async def find_hotels(self, radius: float) -> dict[str, Any]:
        if not self._allow_expand:
            raise ValueError(
                "The search has an explicit geographic boundary; expansion is not allowed"
            )
        if not 1000 <= radius <= 50000 or not self.hotels:
            raise ValueError("Search radius must be 1000–50000 m with a known city")
        async with self._uow() as uow:
            center = await uow.regions.city_center(self.city)
            if center is None:
                center = (
                    median(hotel.location[0] for hotel in self.hotels),
                    median(hotel.location[1] for hotel in self.hotels),
                )
            dy = radius / 111200
            dx = dy / max(cos(radians(center[1])), 0.1)
            bbox = (center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy)
            found = await uow.search.list_hotels(self.region, bbox)
        combined = {hotel.id: hotel for hotel in (*self.hotels, *found)}
        distances = {
            hotel.id: hypot(
                (hotel.location[0] - center[0]) * cos(radians(center[1])),
                hotel.location[1] - center[1],
            )
            * 111200
            for hotel in combined.values()
        }
        selected = sorted(
            (
                hotel
                for hotel in combined.values()
                if distances[hotel.id] <= radius
                and (self._country_scope is None or self._country_scope.contains(hotel.location))
            ),
            key=lambda hotel: (distances[hotel.id], hotel.id),
        )[:500]
        for hotel in selected:
            self.metrics.setdefault(hotel.id, {})["scope.distance_m"] = round(distances[hotel.id])
        self.descriptions["scope.distance_m"] = "Расстояние по прямой до точки города, м"
        self.hotels = tuple(selected)
        if self.bbox is not None:
            bbox = (
                min(bbox[0], self.bbox[0]),
                min(bbox[1], self.bbox[1]),
                max(bbox[2], self.bbox[2]),
                max(bbox[3], self.bbox[3]),
            )
        self.bbox = bbox
        return {
            "hotel_count": len(selected),
            "radius_m": radius,
            "bbox": bbox,
            "available_before_limit": len(combined),
            "limit": 500,
            "country_scope_checked": self._country_scope is not None,
            "samples": [
                {
                    "id": h.id,
                    "name": h.name,
                    "location": h.location,
                    "distance_from_city_m": round(distances[h.id]),
                }
                for h in selected[:8]
            ],
        }

    async def measure_terrain(self, radius: float) -> dict[str, Any]:
        measured = await self._terrain.measure({h.id: h.location for h in self.hotels}, radius)
        self._measurements += 1
        prefix = f"m{self._measurements}"
        for hotel_id, row in measured.items():
            for key, value in row.items():
                self.metrics.setdefault(hotel_id, {})[f"{prefix}.{key}"] = value
        self.descriptions[f"{prefix}.elevation_m"] = "Высота над уровнем моря, м"
        self.descriptions[f"{prefix}.relief_m"] = (
            f"Перепад высот по 9 точкам в радиусе {radius:g} м"
        )
        summary = {}
        for field in ("elevation_m", "relief_m"):
            values = [row[field] for row in measured.values() if field in row]
            if values:
                summary[f"{prefix}.{field}"] = {
                    "min": min(values),
                    "median": median(values),
                    "max": max(values),
                    "count": len(values),
                }
        names = {h.id: h.name for h in self.hotels}
        ordered = sorted(measured, key=lambda key: -measured[key].get("elevation_m", 0))
        return {
            "fields": summary,
            "source": "Copernicus GLO-30 / Mapterhorn DEM",
            "radius_m": radius,
            "hotel_count": len(self.hotels),
            "measured_count": len(measured),
            "highest": [
                {"hotel_id": key, "name": names.get(key), **measured[key]} for key in ordered[:12]
            ],
            "note": "Ground height and sampled relief are approximate; no room or view evidence",
        }
