import asyncio
from collections.abc import Mapping
from math import cos, pi, radians, sin

from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles


class TerrainMeasurements:
    def __init__(self, tiles: CountryTerrainTiles) -> None:
        self._tiles = tiles

    async def measure(
        self, locations: Mapping[str, tuple[float, float]], radius_m: float
    ) -> Mapping[str, Mapping[str, float]]:
        if not 100 <= radius_m <= 5000 or len(locations) > 500:
            raise ValueError("Terrain requests support 500 hotels and a 100–5000 m radius")
        points = {}
        for hotel_id, (lon, lat) in locations.items():
            points[f"{hotel_id}:0"] = (lon, lat)
            for index in range(8):
                angle = index * pi / 4
                points[f"{hotel_id}:{index + 1}"] = (
                    lon + cos(angle) * radius_m / (111200 * max(cos(radians(lat)), 0.1)),
                    lat + sin(angle) * radius_m / 111200,
                )
        samples = await asyncio.to_thread(self._tiles.sample_points, points)
        measured = {}
        for hotel_id in locations:
            center = samples.get(f"{hotel_id}:0")
            if center is None:
                continue
            row = {"elevation_m": round(center, 1)}
            nearby = [
                samples[f"{hotel_id}:{index}"]
                for index in range(9)
                if f"{hotel_id}:{index}" in samples
            ]
            if len(nearby) == 9:
                row["relief_m"] = round(max(nearby) - min(nearby), 1)
            measured[hotel_id] = row
        return measured
