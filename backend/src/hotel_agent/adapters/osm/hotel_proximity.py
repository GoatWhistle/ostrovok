from collections import defaultdict
from collections.abc import Iterable
from math import cos, radians

CELL_DEGREES = 0.02
METRES_PER_DEGREE = 111_200


class HotelProximity:
    def __init__(self, locations: Iterable[tuple[float, float]], radius_m: float) -> None:
        if radius_m <= 0:
            raise ValueError("radius_m must be positive")
        self._radius_m = radius_m
        self._cells: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
        for lon, lat in locations:
            self._cells[self._key(lon, lat)].append((lon, lat))

    def __call__(self, lon: float, lat: float) -> bool:
        latitude_delta = self._radius_m / METRES_PER_DEGREE
        longitude_delta = latitude_delta / max(cos(radians(lat)), 0.01)
        min_x, min_y = self._key(lon - longitude_delta, lat - latitude_delta)
        max_x, max_y = self._key(lon + longitude_delta, lat + latitude_delta)
        for x in range(min_x, max_x + 1):
            for y in range(min_y, max_y + 1):
                for hotel_lon, hotel_lat in self._cells.get((x, y), ()):
                    dx = (hotel_lon - lon) * METRES_PER_DEGREE * cos(radians((lat + hotel_lat) / 2))
                    dy = (hotel_lat - lat) * METRES_PER_DEGREE
                    if dx * dx + dy * dy <= self._radius_m * self._radius_m:
                        return True
        return False

    @staticmethod
    def _key(lon: float, lat: float) -> tuple[int, int]:
        return int(lon // CELL_DEGREES), int(lat // CELL_DEGREES)
