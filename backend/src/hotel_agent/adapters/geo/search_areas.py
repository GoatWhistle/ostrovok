import json
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry
from shapely.prepared import prep


def normalize_name(name: str) -> str:
    tokens = name.casefold().replace("ё", "е").replace("-", " ").split()
    qualifiers = {"республика", "область", "край", "автономный", "округ", "republic", "of"}
    return " ".join(token for token in tokens if token not in qualifiers)


class AreaBoundary:
    def __init__(self, geometry: BaseGeometry) -> None:
        self._geometry = prep(geometry)
        self.bbox: tuple[float, float, float, float] = geometry.bounds

    def contains(self, location: tuple[float, float]) -> bool:
        return bool(self._geometry.covers(Point(*location)))


class SearchAreas:
    def __init__(self, path: Path) -> None:
        self._areas: dict[str, AreaBoundary] = {}
        if not path.is_file():
            return
        for feature in json.loads(path.read_text())["features"]:
            area = AreaBoundary(shape(feature["geometry"]))
            for value in feature["properties"].values():
                if isinstance(value, str):
                    for name in value.split("|"):
                        self._areas[normalize_name(name)] = area

    def resolve(self, name: str) -> AreaBoundary | None:
        return self._areas.get(normalize_name(name))
