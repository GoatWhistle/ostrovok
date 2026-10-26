from collections.abc import Mapping
from dataclasses import dataclass
from math import ceil, sqrt

from shapely.geometry import LineString, Point, Polygon

from hotel_agent.adapters.geo.building_dimensions import building_dimensions, length_values
from hotel_agent.domain.visibility import ElevationRange

ZERO_DROP = ElevationRange(0, 0)


@dataclass(frozen=True, slots=True)
class RoofSample:
    distance_m: float
    drop: ElevationRange = ZERO_DROP
    model: str | None = None


def dome_profile(
    polygon: Polygon,
    line: LineString,
    low: float,
    high: float,
    tags: Mapping[str, str],
) -> tuple[RoofSample, ...] | None:
    roofs = length_values(tags.get("roof:height"))
    dimensions = building_dimensions(tags)
    if (
        tags.get("roof:shape") != "dome"
        or len(roofs) != 1
        or roofs[0] <= 0
        or dimensions.height is None
        or dimensions.height.minimum_m - roofs[0] < dimensions.minimum_height_m
        or polygon.interiors
        or high <= low
    ):
        return None
    center = polygon.centroid
    inner_radius = center.distance(polygon.boundary)
    outer_radius = max(center.distance(Point(coordinate)) for coordinate in polygon.exterior.coords)
    if inner_radius < 0.5 or outer_radius > inner_radius * 1.1 or high - low > 1000:
        return None
    height = roofs[0]
    count = max(1, ceil((high - low) / 0.5))
    peak_distance = line.project(center)
    samples = []
    for index in range(count):
        start, end = low + (high - low) * index / count, low + (high - low) * (index + 1) / count
        nearest = line.interpolate(max(start, min(end, peak_distance))).distance(center)
        upper = max(dome_heights(nearest, outer_radius, height))
        for distance in (start, end):
            radius = line.interpolate(distance).distance(center)
            lower = min(dome_heights(radius, inner_radius, height))
            samples.append(
                RoofSample(
                    distance,
                    ElevationRange(max(0, height - upper), height - lower),
                    "dome_envelope@1",
                )
            )
    return tuple(samples)


def dome_heights(radius: float, extent: float, height: float) -> tuple[float, ...]:
    ratio = min(1, radius / extent)
    ellipsoid = height * sqrt(max(0, 1 - ratio * ratio))
    if height > extent:
        return (ellipsoid,)
    sphere = (extent * extent + height * height) / (2 * height)
    cap = sqrt(max(0, sphere * sphere - min(radius, extent) ** 2)) - sphere + height
    return ellipsoid, max(0, cap)
