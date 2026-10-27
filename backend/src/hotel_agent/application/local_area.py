from collections.abc import Sequence
from dataclasses import dataclass
from math import cos, radians

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.spatial_matching import distance_m

RADIUS_BY_KIND = {"city": 8_000.0, "town": 5_000.0, "borough": 3_500.0, "suburb": 3_000.0}
DEFAULT_RADIUS_M = 4_000.0


@dataclass(frozen=True, slots=True)
class RadiusArea:
    center: tuple[float, float]
    radius_m: float

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        dy = self.radius_m / 111_200
        dx = dy / max(cos(radians(self.center[1])), 0.1)
        return (self.center[0] - dx, self.center[1] - dy, self.center[0] + dx, self.center[1] + dy)

    def contains(self, location: tuple[float, float]) -> bool:
        return distance_m(self.center, location) <= self.radius_m


def area_around(center: tuple[float, float], kind: str | None) -> RadiusArea:
    return RadiusArea(center, RADIUS_BY_KIND.get(kind or "", DEFAULT_RADIUS_M))


def nearest_first(hotels: Sequence[SearchHotelRecord], area: RadiusArea) -> list[SearchHotelRecord]:
    inside = [hotel for hotel in hotels if area.contains(hotel.location)]
    return sorted(inside or hotels, key=lambda hotel: distance_m(area.center, hotel.location))
