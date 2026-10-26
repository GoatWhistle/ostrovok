from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import cast

import httpx
import numpy as np
import rasterio
from rasterio.io import MemoryFile

from hotel_agent.adapters.geo.terrain_cache import TerrainSourceCache
from hotel_agent.adapters.geo.terrain_resampling import enlarge_window
from hotel_agent.adapters.geo.terrain_sampling import sample_points
from hotel_agent.adapters.geo.terrain_tiles import (
    CopernicusTerrainTiles,
    encode_relief,
    encode_terrain,
)
from hotel_agent.domain.errors import TerrainNotFound

MAPTERHORN_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"
MAX_SOURCE_ZOOM = 12


class CountryTerrainTiles:
    def __init__(self, local_dem: Path, cache_dir: Path | None = None) -> None:
        self._dem_path = local_dem
        self._local = CopernicusTerrainTiles(local_dem)
        self._client = httpx.Client(
            timeout=httpx.Timeout(6, connect=2),
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=32),
        )
        self._sources = TerrainSourceCache(self._client, cache_dir)
        self._parents = lru_cache(maxsize=64)(self._decode_parent)
        self._heights = lru_cache(maxsize=256)(self._fetch_heights)
        if local_dem.is_file():
            with rasterio.open(local_dem) as source:
                self._bounds = source.bounds
        else:
            self._bounds = None

    def render(self, z: int, x: int, y: int) -> bytes:
        if self._is_local(z, x, y):
            return self._local.render(z, x, y)
        return encode_terrain(self._heights(z, x, y))

    def render_relief(self, z: int, x: int, y: int) -> bytes:
        if self._is_local(z, x, y):
            return self._local.render_relief(z, x, y)
        return encode_relief(self._heights(z, x, y))

    def close(self) -> None:
        self._client.close()
        self._heights.cache_clear()
        self._parents.cache_clear()
        self._sources.close()

    def sample_points(self, points: Mapping[str, tuple[float, float]]) -> dict[str, float]:
        return sample_points(points, self._dem_path, self._heights)

    def _is_local(self, z: int, x: int, y: int) -> bool:
        if self._bounds is None:
            return False
        west = x / 2**z * 360 - 180
        east = (x + 1) / 2**z * 360 - 180
        north = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y / 2**z))))
        south = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y + 1) / 2**z))))
        return bool(
            self._bounds.left <= west
            and east <= self._bounds.right
            and self._bounds.bottom <= south
            and north <= self._bounds.top
        )

    def _fetch_heights(self, z: int, x: int, y: int) -> np.ndarray:
        source_z = min(z, MAX_SOURCE_ZOOM)
        shift = z - source_z
        parent = self._parents(source_z, x >> shift, y >> shift)
        return enlarge_window(parent, x % 2**shift, y % 2**shift, 2**shift)

    def _decode_parent(self, z: int, x: int, y: int) -> np.ndarray:
        try:
            data = self._sources.get(MAPTERHORN_URL.format(z=z, x=x, y=y), z, x, y)
        except httpx.HTTPStatusError as error:
            if error.response.status_code == 404:
                raise TerrainNotFound() from error
            raise
        with MemoryFile(data) as memory, memory.open() as source:
            rgb = source.read([1, 2, 3]).astype(np.float32)
        return cast(np.ndarray, rgb[0] * 256 + rgb[1] + rgb[2] / 256 - 32768)
