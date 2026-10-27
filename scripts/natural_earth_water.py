import argparse
import json
from collections.abc import Iterable
from pathlib import Path

from shapely import set_precision
from shapely.geometry import LineString, MultiLineString, Polygon, box, shape
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient

LAKE_MAX_SCALERANK = 6
CELL = 15
WORLD = box(-180, -90, 180, 90)
CELLS = [
    box(x, y, x + CELL, y + CELL) for x in range(-180, 180, CELL) for y in range(-90, 90, CELL)
]
GRID_LINES = MultiLineString(
    [((x, -90), (x, 90)) for x in range(-180, 181, CELL)]
    + [((-180, y), (180, y)) for y in range(-90, 91, CELL)]
)
PRESETS = {"far": (0.03, 0.005, 2), "near": (0.006, 0.001, 3)}


def ring(coords: Iterable[tuple[float, ...]], digits: int) -> list[list[float]]:
    return [[round(point[0], digits), round(point[1], digits)] for point in coords]


def feature(part: Polygon, min_area: float, digits: int) -> dict[str, object]:
    holes = [ring(hole.coords, digits) for hole in part.interiors if Polygon(hole).area >= min_area]
    return {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [ring(part.exterior.coords, digits), *holes],
        },
    }


def seams(geometries: list[BaseGeometry]) -> list[dict[str, object]]:
    lines: list[LineString] = []
    for geometry in geometries:
        cut = GRID_LINES.intersection(geometry)
        lines += [part for part in getattr(cut, "geoms", [cut]) if isinstance(part, LineString)]
    return [
        {
            "type": "Feature",
            "properties": {"seam": True},
            "geometry": {"type": "LineString", "coordinates": [list(p) for p in line.coords]},
        }
        for line in lines
        if line.length > 0
    ]


def shapes(path: Path, tolerance: float, lakes: bool) -> list[BaseGeometry]:
    items = json.loads(path.read_text(encoding="utf-8"))["features"]
    return [
        shape(item["geometry"]).simplify(tolerance, preserve_topology=True)
        for item in items
        if not lakes or int(item["properties"].get("scalerank", 9)) <= LAKE_MAX_SCALERANK
    ]


def polygons(geometry: BaseGeometry, digits: int) -> list[Polygon]:
    snapped = set_precision(geometry, 10**-digits)
    return [
        orient(part) for part in getattr(snapped, "geoms", [snapped]) if isinstance(part, Polygon)
    ]


def features(
    geometries: list[BaseGeometry], min_area: float, digits: int, cells: list[Polygon]
) -> list[dict[str, object]]:
    pieces = [geometry.intersection(cell) for geometry in geometries for cell in cells]
    parts = [part for piece in pieces if not piece.is_empty for part in polygons(piece, digits)]
    return [feature(part, min_area, digits) for part in parts if part.area >= min_area]


def collection(raw: Path, tolerance: float, min_area: float, digits: int) -> str:
    ocean = shapes(raw / "ne_10m_ocean.geojson", tolerance, False)
    lakes = shapes(raw / "ne_10m_lakes.geojson", tolerance, True)
    items = features(ocean, min_area, digits, CELLS) + seams(ocean)
    items += features(lakes, min_area, digits, [WORLD])
    return json.dumps({"type": "FeatureCollection", "features": items}, separators=(",", ":"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("raw", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    for name, options in PRESETS.items():
        target = args.output / f"water-{name}.geojson"
        target.write_text(collection(args.raw, *options), encoding="utf-8", newline="\n")
        print(target.name, target.stat().st_size)


if __name__ == "__main__":
    main()
