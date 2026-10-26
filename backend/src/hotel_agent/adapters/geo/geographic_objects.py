import asyncio

from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.ops import nearest_points, transform

from hotel_agent.adapters.geo.search_areas import AreaBoundary
from hotel_agent.application.ports.view_geometry import PhysicalObject, ViewGeometryPort


class GeographicShape:
    def __init__(self, source: PhysicalObject) -> None:
        geometry = shape(source.geometry)
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError("Invalid geographic object geometry")
        center = geometry.representative_point()
        crs = CRS.from_proj4(
            f"+proj=aeqd +lat_0={center.y} +lon_0={center.x} +datum=WGS84 +units=m"
        )
        self._forward = Transformer.from_crs(4326, crs, always_xy=True)
        self._inverse = Transformer.from_crs(crs, 4326, always_xy=True)
        self._geometry = transform(self._forward.transform, geometry)
        self._water = source.tags.get("natural") == "water"

    def area(self, radius_m: float) -> AreaBoundary:
        return AreaBoundary(transform(self._inverse.transform, self._geometry.buffer(radius_m)))

    def nearest(self, location: tuple[float, float]) -> tuple[float, float]:
        position = Point(*self._forward.transform(*location))
        geometry = (
            self._geometry.boundary
            if self._water and self._geometry.geom_type in {"Polygon", "MultiPolygon"}
            else self._geometry
        )
        nearest = nearest_points(position, geometry)[1]
        lon, lat = self._inverse.transform(nearest.x, nearest.y)
        return float(lon), float(lat)


class GeographicObjects:
    def __init__(self, geometry: ViewGeometryPort) -> None:
        self._geometry = geometry
        self._cache: dict[str, GeographicShape] = {}

    async def get(self, identifier: str) -> GeographicShape | None:
        if identifier in self._cache:
            return self._cache[identifier]
        source = await self._geometry.object(identifier)
        if source is None:
            return None
        try:
            result = await asyncio.to_thread(GeographicShape, source)
        except ValueError:
            return None
        if len(self._cache) >= 128:
            self._cache.pop(next(iter(self._cache)))
        self._cache[identifier] = result
        return result
