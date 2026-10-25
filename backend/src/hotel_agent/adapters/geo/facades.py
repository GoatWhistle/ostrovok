import math
from collections.abc import Sequence
from itertools import pairwise

from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.geometry.polygon import orient

from hotel_agent.application.ports.facades import BuildingFootprint, FacadeSegment


class FootprintFacadeExtractor:
    def __init__(self) -> None:
        self._project = Transformer.from_crs(4326, 32637, always_xy=True)

    def extract(self, footprint: BuildingFootprint) -> Sequence[FacadeSegment]:
        geometry = shape(footprint.geometry)
        polygon = (
            max(geometry.geoms, key=lambda item: item.area)
            if isinstance(geometry, MultiPolygon)
            else geometry
        )
        if not isinstance(polygon, Polygon) or polygon.is_empty:
            return []
        ring = list(orient(polygon, sign=1).exterior.coords)
        segments: list[FacadeSegment] = []
        for first, second in pairwise(ring):
            ax, ay = self._project.transform(*first)
            bx, by = self._project.transform(*second)
            dx, dy = bx - ax, by - ay
            if math.hypot(dx, dy) < 2:
                continue
            azimuth = math.degrees(math.atan2(dy, -dx)) % 360
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
