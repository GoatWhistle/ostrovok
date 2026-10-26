from collections.abc import Sequence
from itertools import pairwise

from pyproj import Geod
from shapely.geometry import MultiPolygon, Polygon, shape

from hotel_agent.application.ports.facades import BuildingFootprint, FacadeSegment


class FootprintFacadeExtractor:
    def __init__(self) -> None:
        self._geod = Geod(ellps="WGS84")

    def extract(self, footprint: BuildingFootprint) -> Sequence[FacadeSegment]:
        geometry = shape(footprint.geometry)
        polygon = (
            max(geometry.geoms, key=lambda item: item.area)
            if isinstance(geometry, MultiPolygon)
            else geometry
        )
        if not isinstance(polygon, Polygon) or polygon.is_empty or not polygon.is_valid:
            return []
        ring = list(polygon.exterior.coords)
        area, _ = self._geod.polygon_area_perimeter(
            [coordinate[0] for coordinate in ring], [coordinate[1] for coordinate in ring]
        )
        if area < 0:
            ring.reverse()
        segments: list[FacadeSegment] = []
        for first, second in pairwise(ring):
            heading, _, length = self._geod.inv(*first[:2], *second[:2])
            if length < 2:
                continue
            azimuth = (heading + 90) % 360
            index = len(segments) + 1
            segments.append(
                FacadeSegment(
                    id=f"fc_{footprint.hotel_id}_{index}",
                    hotel_id=footprint.hotel_id,
                    building_id=footprint.building_id,
                    azimuth_deg=round(azimuth, 1) % 360,
                    label=f"Фасад {index}",
                    geometry={"type": "LineString", "coordinates": [list(first), list(second)]},
                )
            )
        return segments
