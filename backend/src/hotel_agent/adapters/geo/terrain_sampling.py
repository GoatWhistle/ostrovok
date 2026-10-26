from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from math import asinh, floor, isfinite, pi, radians, tan
from pathlib import Path

import httpx
import numpy as np
import rasterio

from hotel_agent.domain.errors import TerrainNotFound


def sample_points(
    points: Mapping[str, tuple[float, float]],
    dem_path: Path,
    heights: Callable[[int, int, int], np.ndarray],
) -> dict[str, float]:
    values: dict[str, float] = {}
    remaining = dict(points)
    if dem_path.is_file():
        with rasterio.open(dem_path) as source:
            local = {
                key: point
                for key, point in points.items()
                if source.bounds.left <= point[0] <= source.bounds.right
                and source.bounds.bottom <= point[1] <= source.bounds.top
            }
            for key, sampled in zip(
                local, source.sample(local.values(), indexes=1, masked=True), strict=True
            ):
                if not np.ma.is_masked(sampled[0]) and isfinite(float(sampled[0])):
                    values[key] = float(sampled[0])
                    remaining.pop(key)
    groups: dict[tuple[int, int], list[tuple[str, int, int]]] = {}
    z = 12
    for key, (lon, lat) in remaining.items():
        if not -180 <= lon <= 180 or not -85 < lat < 85:
            continue
        x = (lon + 180) / 360 * 2**z
        y = (1 - asinh(tan(radians(lat))) / pi) / 2 * 2**z
        tile = (floor(x), floor(y))
        groups.setdefault(tile, []).append((key, int((x % 1) * 256), int((y % 1) * 256)))

    def read(tile: tuple[int, int]) -> dict[str, float]:
        try:
            array = heights(z, *tile)
        except (httpx.HTTPError, rasterio.errors.RasterioError, ValueError, TerrainNotFound):
            return {}
        return {
            key: float(array[y, x]) for key, x, y in groups[tile] if isfinite(float(array[y, x]))
        }

    with ThreadPoolExecutor(max_workers=4) as executor:
        for batch in executor.map(read, groups):
            values.update(batch)
    return values
