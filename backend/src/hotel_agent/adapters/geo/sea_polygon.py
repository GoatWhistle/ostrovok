from collections.abc import Sequence
from itertools import pairwise
from pathlib import Path
from typing import Any

import rasterio
from shapely.geometry import LineString, MultiPolygon, box, mapping, shape
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

from hotel_agent.application.dto import Feature


def sea_polygon(
    coastlines: Sequence[Feature], bbox: tuple[float, float, float, float], dem: Path
) -> tuple[Feature, dict[str, object]]:
    bounds = box(*bbox)
    lines: list[Any] = []
    segments: list[Any] = []
    for feature in coastlines:
        geometry = shape(feature.geometry)
        for line in getattr(geometry, "geoms", [geometry]):
            clipped = line.intersection(bounds)
            if not clipped.is_empty:
                lines.append(clipped)
            coordinates = list(line.coords)
            segments.extend(LineString([a, b]) for a, b in pairwise(coordinates) if a != b)
    tree = STRtree(segments)
    polygons = list(polygonize(unary_union([bounds.boundary, *lines])))
    sea = []
    checks = []
    with rasterio.open(dem) as raster:
        for polygon in polygons:
            point = polygon.representative_point()
            nearest = tree.nearest(point)
            if nearest is None:
                continue
            a, b = list(segments[int(nearest)].coords)
            cross = (b[0] - a[0]) * (point.y - a[1]) - (b[1] - a[1]) * (point.x - a[0])
            height = float(next(raster.sample([(point.x, point.y)]))[0])
            water = cross < 0
            checks.append(
                {
                    "point": [point.x, point.y],
                    "right_of_coast": water,
                    "dem_m": round(height, 2),
                    "area_deg2": polygon.area,
                }
            )
            if water and height > 5:
                raise ValueError("Sea orientation conflicts with DEM elevation")
            if water:
                sea.append(polygon)
    merged = unary_union(sea)
    if merged.is_empty:
        raise ValueError("No sea polygon could be assembled from the Sochi coast")
    geometry = merged if isinstance(merged, MultiPolygon) else MultiPolygon([merged])
    return Feature(
        id="sea:sochi",
        geometry=mapping(geometry),
        properties={"natural": "water", "water": "sea", "source": "osm_coastline"},
    ), {"pieces": len(polygons), "sea_pieces": len(sea), "dem_checks": checks}
