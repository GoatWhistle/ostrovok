from collections.abc import Sequence
from typing import Any

from shapely import make_valid
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box, mapping
from shapely.ops import polygonize, unary_union

from hotel_agent.application.dto import Feature

SOCHI = (39.55, 43.35, 40.0, 43.75)


def _line(element: dict[str, Any]) -> LineString | None:
    coordinates = [(point["lon"], point["lat"]) for point in element.get("geometry", []) if point]
    return LineString(coordinates) if len(coordinates) >= 2 else None


def _relation(element: dict[str, Any]) -> Any:
    outer: list[Any] = []
    inner: list[Any] = []
    for member in element.get("members", []):
        line = _line(member)
        if line is not None:
            (inner if member.get("role") == "inner" else outer).append(line)
    outside = unary_union(list(polygonize(unary_union(outer))))
    holes = unary_union(list(polygonize(unary_union(inner))))
    return outside.difference(holes)


def map_features(elements: Sequence[dict[str, Any]]) -> list[Feature]:
    result = []
    bounds = box(*SOCHI)
    for element in elements:
        tags = element.get("tags", {})
        kind = element["type"]
        geometry: Any = None
        if kind == "node" and "lon" in element:
            geometry = Point(element["lon"], element["lat"])
        elif kind == "relation" and tags.get("type") == "multipolygon":
            geometry = _relation(element)
        elif kind == "way":
            line = _line(element)
            if line is not None:
                area = line.is_ring and not tags.get("highway") and tags.get("area") != "no"
                geometry = Polygon(line) if area else line
        if geometry is None or geometry.is_empty:
            continue
        clipped = make_valid(geometry).intersection(bounds)
        if clipped.is_empty:
            continue
        if isinstance(clipped, Polygon):
            clipped = MultiPolygon([clipped])
        if clipped.geom_type not in {"MultiPolygon", "Point", "LineString", "MultiLineString"}:
            continue
        result.append(
            Feature(id=f"{kind[0]}{element['id']}", geometry=mapping(clipped), properties=tags)
        )
    return result
