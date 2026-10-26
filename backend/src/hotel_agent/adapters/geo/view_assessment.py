import asyncio
from collections.abc import Mapping
from math import atan2, cos, degrees, radians, sin
from typing import Any

from pyproj import Transformer
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform

from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class NearbyViewAssessment:
    def __init__(self, terrain: CountryTerrainTiles, uow: UnitOfWorkFactory) -> None:
        self._terrain, self._uow = terrain, uow

    async def assess(
        self,
        locations: Mapping[str, tuple[float, float]],
        direction_deg: float,
        observer_height_m: float,
        radius_m: float,
    ) -> Mapping[str, Mapping[str, float]]:
        if (
            not 50 <= radius_m <= 500
            or not 1 <= observer_height_m <= 200
            or not 0 <= direction_deg < 360
        ):
            raise ValueError(
                "View requires radius 50–500 m, observer height 1–200 m and azimuth 0–360"
            )
        result = {}
        for hotel_id, location in list(locations.items())[:4]:
            async with self._uow() as uow:
                buildings = await uow.search.list_context_buildings(hotel_id, radius_m)
            lon, lat = location
            project = Transformer.from_crs(
                4326, f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m", always_xy=True
            )
            inverse = Transformer.from_crs(project.target_crs, 4326, always_xy=True)
            angle = radians(direction_deg)
            ray = LineString([(0, 0), (radius_m * sin(angle), radius_m * cos(angle))])
            points = {"origin": location}
            obstacles: list[tuple[str, float, float]] = []
            unknown = 0
            for index in range(1, 17):
                distance = radius_m * index / 16
                key = f"terrain:{index}"
                points[key] = inverse.transform(distance * sin(angle), distance * cos(angle))
                obstacles.append((key, distance, 0))
            for building in buildings:
                polygon: Any = transform(project.transform, shape(building.geometry))
                intersection = polygon.intersection(ray)
                if intersection.is_empty:
                    continue
                if building.height_estimated or building.height_m is None:
                    unknown += 1
                    continue
                distance = max(1, intersection.distance(Point(0, 0)))
                key = f"building:{building.id}"
                points[key] = inverse.transform(distance * sin(angle), distance * cos(angle))
                obstacles.append((key, distance, building.height_m))
            heights = await asyncio.to_thread(self._terrain.sample_points, points)
            if "origin" not in heights:
                continue
            observer = heights["origin"] + observer_height_m
            angles = [
                degrees(atan2(heights[key] + height - observer, distance))
                for key, distance, height in obstacles
                if key in heights
            ]
            if not angles:
                continue
            result[hotel_id] = {
                "horizon_angle_deg": round(max(angles), 2),
                "observer_height_m": observer_height_m,
                "direction_deg": direction_deg,
                "radius_m": radius_m,
                "terrain_samples": float(sum(k.startswith("terrain:") for k in heights)),
                "known_building_obstacles": float(sum(k.startswith("building:") for k in heights)),
                "unknown_building_heights": float(unknown),
            }
        return result
