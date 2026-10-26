from collections.abc import Callable, Sequence
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.spatial_matching import distance_m


class CoastMeasurements:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
        geo_refs: dict[str, dict[str, tuple[str, ...]]],
    ) -> None:
        self._uow, self._hotels = uow, hotels
        self.metrics, self.descriptions, self.geo_refs = metrics, descriptions, geo_refs
        self._count = 0

    async def measure(self) -> dict[str, Any]:
        async with self._uow() as uow:
            points = await uow.coastlines.nearest_points(tuple(h.id for h in self._hotels()))
        self._count += 1
        field = f"g{self._count}.distance_m"
        self.descriptions[field] = "Расстояние до известной береговой линии по прямой, м"
        measured = []
        for hotel in self._hotels():
            if hotel.id not in points:
                continue
            coast = points[hotel.id]
            value = round(distance_m(hotel.location, coast), 1)
            self.metrics.setdefault(hotel.id, {})[field] = value
            self.geo_refs.setdefault(hotel.id, {})[field] = (
                f"g_point_{hotel.location[0]:.6f}_{hotel.location[1]:.6f}",
                f"g_point_{coast[0]:.6f}_{coast[1]:.6f}",
            )
            measured.append({"hotel_id": hotel.id, "name": hotel.name, "distance_m": value})
        return {
            "field": field,
            "source": "OpenStreetMap coastline",
            "measured_count": len(measured),
            "nearest": sorted(measured, key=lambda row: float(str(row["distance_m"])))[:12],
            "note": "Straight-line distance only; does not establish walking time or access.",
        }
