from pyproj import Geod
from shapely.geometry import Point, shape
from shapely.ops import nearest_points

from hotel_agent.adapters.geo.building_dimensions import building_dimensions, length_values
from hotel_agent.adapters.geo.roof_profile import dome_apex
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.view_geometry import PhysicalObject, ViewGeometryPort
from hotel_agent.domain.visibility import ElevationRange

GEOD = Geod(ellps="WGS84")


class WindowTargets:
    def __init__(self, geometry: ViewGeometryPort) -> None:
        self._geometry = geometry

    async def resolve(
        self, target: NamedPlaceRecord | tuple[float, float]
    ) -> PhysicalObject | None:
        if isinstance(target, NamedPlaceRecord):
            return await self._geometry.object(target.id)
        return PhysicalObject(
            "coastline",
            {"natural": "water", "water": "sea", "name": "Море"},
            {"type": "Point", "coordinates": list(target)},
            "local:osm-coastline",
        )

    async def parts(self, target: PhysicalObject) -> tuple[PhysicalObject, ...]:
        polygon = shape(target.geometry)
        if polygon.geom_type not in {"Polygon", "MultiPolygon"}:
            return (target,)
        west, south, east, north = polygon.bounds
        if (east - west + 0.0004) * (north - south + 0.0004) > 0.001:
            return (target,)
        area = await self._geometry.area(
            (west - 0.0002, south - 0.0002, east + 0.0002, north + 0.0002)
        )
        if area is None:
            return (target,)
        candidates = [target]
        candidates.extend(
            building
            for building in area.buildings
            if building.tags.get("building:part") not in {None, "no"}
            and polygon.covers(shape(building.geometry).representative_point())
        )

        def height(item: PhysicalObject) -> float:
            dimension = building_dimensions(item.tags).height
            return dimension.minimum_m if dimension else 0

        known = [item for item in candidates if building_dimensions(item.tags).height is not None]
        return tuple(sorted(known, key=height, reverse=True)) if known else (target,)


def target_point(
    target: PhysicalObject, hotel: tuple[float, float], *, top: bool = False
) -> tuple[tuple[float, float], ElevationRange]:
    geometry = shape(target.geometry)
    dimensions = building_dimensions(target.tags)
    water = target.tags.get("natural") == "water" or target.tags.get("waterway") is not None
    if target.id == "coastline":
        coast: tuple[float, float] = (geometry.x, geometry.y)
        azimuth, _, _ = GEOD.inv(*hotel, *coast)
        lon, lat, _ = GEOD.fwd(*coast, azimuth, 100)
        return (lon, lat), ElevationRange(0, 0)
    if water or geometry.geom_type in {"LineString", "MultiLineString"}:
        nearest = nearest_points(Point(hotel), geometry)[1]
        if water and geometry.geom_type in {"Polygon", "MultiPolygon"}:
            interior = geometry.representative_point()
            step = min(0.01, 0.0001 / max(nearest.distance(interior), 0.0001))
            nearest = Point(
                nearest.x + (interior.x - nearest.x) * step,
                nearest.y + (interior.y - nearest.y) * step,
            )
        return (nearest.x, nearest.y), ElevationRange(0, 0 if water else None)
    apex = dome_apex(geometry, target.tags)
    if apex is not None and dimensions.height is not None:
        if top:
            return apex, dimensions.height
        edge = nearest_points(Point(hotel), geometry)[1]
        roof = length_values(target.tags.get("roof:height"))[0]
        return (edge.x, edge.y), ElevationRange(
            dimensions.height.minimum_m - roof,
            dimensions.height.maximum_m - roof if dimensions.height.maximum_m is not None else None,
        )
    point = (
        nearest_points(Point(hotel), geometry)[1]
        if geometry.geom_type in {"Polygon", "MultiPolygon"}
        else geometry.representative_point()
    )
    height = dimensions.height or ElevationRange(0, None)
    if target.tags.get("natural") in {"peak", "volcano", "hill"}:
        height = ElevationRange(0, 0)
    return (point.x, point.y), height
