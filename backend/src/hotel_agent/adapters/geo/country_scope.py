import json
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.prepared import prep


class CountryBoundary:
    def __init__(self, path: Path) -> None:
        self._geometry = (
            prep(shape(json.loads(path.read_text())["geometry"])) if path.is_file() else None
        )

    def contains(self, location: tuple[float, float]) -> bool:
        if self._geometry is None:
            raise ValueError(
                "The country boundary dataset is unavailable; search cannot be expanded"
            )
        return bool(self._geometry.covers(Point(*location)))
