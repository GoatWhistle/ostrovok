from itertools import pairwise
from math import atan2, cos, degrees, hypot, radians
from typing import Any

from pyproj import Transformer
from shapely import transform
from shapely.geometry import LineString, Point, shape

from hotel_agent.application.visibility_records import FacadeObserver


def angle_difference(first: float, second: float) -> float:
    return abs((first - second + 180) % 360 - 180)


def facade_observers(
    footprint: dict[str, Any],
    hotel_location: tuple[float, float],
    target_location: tuple[float, float],
    requested_azimuth_deg: float | None = None,
) -> tuple[FacadeObserver, ...]:
    if requested_azimuth_deg is not None and not 0 <= requested_azimuth_deg < 360:
        raise ValueError("Facade azimuth must be 0–360 degrees")
    lon, lat = hotel_location
    project = Transformer.from_crs(
        4326, f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m", always_xy=True
    )
    inverse = Transformer.from_crs(project.target_crs, 4326, always_xy=True)
    building: Any = transform(shape(footprint), project.transform, interleaved=False)
    if building.is_empty or not building.is_valid:
        return ()
    polygons = [building] if building.geom_type == "Polygon" else list(building.geoms)
    tx, ty = project.transform(*target_location)
    candidates = []
    for polygon_index, polygon in enumerate(polygons):
        if polygon.geom_type != "Polygon":
            continue
        coordinates = list(polygon.exterior.coords)
        for edge, (start, end) in enumerate(pairwise(coordinates)):
            dx, dy = end[0] - start[0], end[1] - start[1]
            width = hypot(dx, dy)
            if width < 1:
                continue
            nx, ny = (
                (dy / width, -dx / width) if polygon.exterior.is_ccw else (-dy / width, dx / width)
            )
            azimuth = degrees(atan2(nx, ny)) % 360
            if (
                requested_azimuth_deg is not None
                and angle_difference(azimuth, requested_azimuth_deg) > 45
            ):
                continue
            for fraction in (0.5, 0.25, 0.75):
                x = start[0] + dx * fraction + nx * 0.25
                y = start[1] + dy * fraction + ny * 0.25
                length = hypot(tx - x, ty - y)
                if length < 1 or ((tx - x) * nx + (ty - y) * ny) / length < cos(radians(60)):
                    continue
                if (
                    building.covers(Point(x, y))
                    or building.intersection(LineString([(x, y), (tx, ty)])).length > 0.1
                ):
                    continue
                heading = degrees(atan2(tx - x, ty - y)) % 360
                observer = FacadeObserver(
                    f"facade:{polygon_index}:{edge}:{fraction}",
                    inverse.transform(x, y),
                    round(azimuth, 2) % 360,
                    width,
                )
                candidates.append((angle_difference(azimuth, heading), -width, observer))
    return tuple(
        row[2] for row in sorted(candidates, key=lambda row: (row[0], row[1], row[2].id))[:6]
    )
