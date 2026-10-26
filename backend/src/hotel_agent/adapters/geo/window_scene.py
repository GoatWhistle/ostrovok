from dataclasses import dataclass
from itertools import pairwise
from math import ceil, cos, floor, radians
from typing import Any

from pyproj import Geod, Transformer
from shapely import transform
from shapely.geometry import LineString, Point, shape

from hotel_agent.adapters.geo.building_dimensions import building_dimensions
from hotel_agent.adapters.geo.roof_profile import RoofSample, dome_profile
from hotel_agent.application.ports.view_scenes import SceneBuilding
from hotel_agent.application.ports.window_views import WindowRay
from hotel_agent.domain.visibility import ElevationRange, RayObstacle

GEOD = Geod(ellps="WGS84")
CELL_DEGREES = 0.005


@dataclass(frozen=True, slots=True)
class SceneSamples:
    distance_m: float
    points: dict[str, tuple[float, float]]
    terrain: tuple[tuple[str, float], ...]
    buildings: tuple[tuple[SceneBuilding, tuple[RoofSample, ...], tuple[str, ...]], ...]


def corridor_cells(ray: WindowRay) -> tuple[tuple[float, float, float, float], ...]:
    start, end = ray.observer.location, ray.target_location
    _, _, length = GEOD.inv(*start, *end)
    points = [start, *GEOD.npts(*start, *end, max(1, ceil(length / 150))), end]
    cells = set()
    for first, second in pairwise(points):
        lat = max(first[1], second[1])
        dx, dy = 40 / (111200 * max(cos(radians(lat)), 0.1)), 40 / 111200
        west, east = min(first[0], second[0]) - dx, max(first[0], second[0]) + dx
        south, north = min(first[1], second[1]) - dy, max(first[1], second[1]) + dy
        for x in range(floor(west / CELL_DEGREES), floor(east / CELL_DEGREES) + 1):
            for y in range(floor(south / CELL_DEGREES), floor(north / CELL_DEGREES) + 1):
                cells.add(
                    (
                        x * CELL_DEGREES,
                        y * CELL_DEGREES,
                        (x + 1) * CELL_DEGREES,
                        (y + 1) * CELL_DEGREES,
                    )
                )
    return tuple(sorted(cells))


def ground_points(point: tuple[float, float], prefix: str) -> dict[str, tuple[float, float]]:
    points = {}
    for index, angle in enumerate(range(0, 360, 45)):
        lon, lat, _ = GEOD.fwd(*point, angle, 40)
        points[f"{prefix}:{index}"] = (lon, lat)
    return points


def scene_samples(ray: WindowRay, buildings: tuple[SceneBuilding, ...]) -> SceneSamples:
    start, end = ray.observer.location, ray.target_location
    _, _, length = GEOD.inv(*start, *end)
    project = Transformer.from_crs(
        4326,
        f"+proj=aeqd +lat_0={start[1]} +lon_0={start[0]} +datum=WGS84 +units=m",
        always_xy=True,
    )
    inverse = Transformer.from_crs(project.target_crs, 4326, always_xy=True)
    line = LineString([(0, 0), project.transform(*end)])
    points = {
        "target": end,
        **ground_points(start, "observer-ground"),
        **ground_points(end, "target-ground"),
    }
    crossings: list[tuple[SceneBuilding, tuple[RoofSample, ...], tuple[str, ...]]] = []
    polygons = []
    for building in buildings:
        polygon: Any = transform(shape(building.geometry), project.transform, interleaved=False)
        if polygon.geom_type == "MultiPolygon" and len(polygon.geoms) == 1:
            polygon = polygon.geoms[0]
        if not polygon.is_valid:
            continue
        intersection = polygon.intersection(line)
        if intersection.is_empty:
            continue
        if (
            building.id == ray.target.id
            and polygon.boundary.distance(Point(project.transform(*end))) < 0.5
        ):
            continue
        nearest, farthest = polygon.distance(Point(0, 0)), 0.0
        segments = (
            [intersection]
            if intersection.geom_type in {"LineString", "Point"}
            else list(intersection.geoms)
        )
        distances: list[RoofSample] = []
        for segment in segments:
            if not hasattr(segment, "coords"):
                continue
            projected = [line.project(Point(coordinate)) for coordinate in segment.coords]
            if not projected:
                continue
            low, high = min(projected), max(projected)
            roof = (
                dome_profile(polygon, line, low, high, building.tags)
                if polygon.geom_type == "Polygon"
                else None
            )
            distances.extend(
                roof
                if roof is not None
                else (RoofSample(low + 0.05), RoofSample((low + high) / 2), RoofSample(high - 0.05))
            )
            farthest = max(farthest, high)
        if not distances:
            continue
        if nearest < 1 and farthest < 2:
            continue
        index = len(crossings)
        anchor = polygon.exterior if polygon.geom_type == "Polygon" else polygon.boundary
        base = anchor.interpolate(anchor.project(intersection.representative_point()))
        prefix = f"building-ground:{index}"
        samples = ground_points(inverse.transform(base.x, base.y), prefix)
        points.update(samples)
        crossings.append(
            (
                building,
                tuple(d for d in distances if 0.5 < d.distance_m < length - 0.5),
                tuple(samples),
            )
        )
        polygons.append(polygon)
    terrain = []
    steps = max(2, ceil(length / 25))
    for index in range(1, steps):
        distance = length * index / steps
        if min(distance, length - distance) < 30:
            continue
        point = line.interpolate(distance)
        if any(polygon.covers(point) for polygon in polygons):
            continue
        key = f"terrain:{index}"
        points[key] = inverse.transform(point.x, point.y)
        terrain.append((key, distance))
    return SceneSamples(length, points, tuple(terrain), tuple(crossings))


def base_elevation(heights: dict[str, float], keys: tuple[str, ...]) -> ElevationRange | None:
    values = [heights[key] for key in keys if key in heights]
    if len(values) < max(1, len(keys) // 2):
        return None
    return ElevationRange(min(values) - 1, min(values) + 3)


def obstacles(
    samples: SceneSamples,
    heights: dict[str, float],
    target_id: str | None = None,
    target_base: ElevationRange | None = None,
) -> tuple[RayObstacle, ...]:
    result = [
        RayObstacle(
            key,
            "terrain",
            distance,
            ElevationRange(heights[key] - 1, heights[key] + 1) if key in heights else None,
        )
        for key, distance in samples.terrain
    ]
    for building, distances, ground_keys in samples.buildings:
        shared_base = target_base if building.id == target_id else None
        base = shared_base or base_elevation(heights, ground_keys)
        dimensions = building_dimensions(building.tags, building.height_m, building.levels)
        height = dimensions.height
        top = (
            ElevationRange(
                base.minimum_m + height.minimum_m,
                base.maximum_m + height.maximum_m
                if base.maximum_m is not None and height.maximum_m is not None
                else None,
            )
            if base is not None and height is not None
            else None
        )
        bottom = (
            ElevationRange(
                base.minimum_m + dimensions.minimum_height_m,
                base.maximum_m + dimensions.minimum_height_m
                if base.maximum_m is not None
                else None,
            )
            if base is not None and dimensions.minimum_height_m > 0
            else None
        )
        for sample in distances:
            roof_top = (
                ElevationRange(
                    top.minimum_m - (sample.drop.maximum_m or 0),
                    top.maximum_m - sample.drop.minimum_m if top.maximum_m is not None else None,
                )
                if top
                else None
            )
            result.append(
                RayObstacle(
                    building.id,
                    "building",
                    sample.distance_m,
                    roof_top,
                    bottom,
                    sample.model,
                    shared_base.maximum_m - shared_base.minimum_m
                    if shared_base is not None
                    and shared_base.maximum_m is not None
                    and roof_top is not None
                    and roof_top.maximum_m is not None
                    else 0,
                )
            )
    return tuple(result)
