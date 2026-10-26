from pyproj import Transformer
from shapely import transform
from shapely.geometry import Point, Polygon, shape
from shapely.ops import nearest_points

from hotel_agent.adapters.geo.building_dimensions import building_dimensions
from hotel_agent.adapters.geo.roof_profile import dome_dimensions, dome_heights
from hotel_agent.application.ports.view_geometry import PhysicalObject
from hotel_agent.domain.visibility import ElevationRange


def dome_surface_points(
    target: PhysicalObject, observer: tuple[float, float]
) -> tuple[tuple[tuple[float, float], ElevationRange], ...]:
    geometry = shape(target.geometry)
    if geometry.geom_type == "MultiPolygon" and len(geometry.geoms) == 1:
        geometry = geometry.geoms[0]
    if not isinstance(geometry, Polygon) or not geometry.is_valid:
        return ()
    center = geometry.centroid
    projection = Transformer.from_crs(
        4326,
        f"+proj=aeqd +lat_0={center.y} +lon_0={center.x} +datum=WGS84 +units=m",
        always_xy=True,
    )
    local = transform(geometry, projection.transform, interleaved=False)
    dimensions = dome_dimensions(local, target.tags)
    height = building_dimensions(target.tags).height
    if dimensions is None or height is None or height.maximum_m is None:
        return ()
    center, inner, outer, roof = dimensions
    edge = nearest_points(local.boundary, Point(projection.transform(*observer)))[0]
    inverse = Transformer.from_crs(projection.target_crs, 4326, always_xy=True)
    points = []
    for fraction in (0.125, 0.25, 0.5, 0.75, 1.0):
        point = Point(
            edge.x + (center.x - edge.x) * fraction, edge.y + (center.y - edge.y) * fraction
        )
        radius = point.distance(center)
        lower = min(dome_heights(radius, inner, roof))
        upper = max(dome_heights(radius, outer, roof))
        lon, lat = inverse.transform(point.x, point.y)
        points.append(
            (
                (float(lon), float(lat)),
                ElevationRange(
                    height.minimum_m - roof + lower,
                    height.maximum_m - roof + upper,
                ),
            )
        )
    return tuple(points)
