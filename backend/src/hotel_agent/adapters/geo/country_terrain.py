from functools import lru_cache
from pathlib import Path
from typing import cast

import httpx
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.windows import Window

from hotel_agent.adapters.geo.terrain_tiles import (
    CopernicusTerrainTiles,
    encode_relief,
    encode_terrain,
)

MAPTERHORN_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"
MAX_SOURCE_ZOOM = 12


class CountryTerrainTiles:
    def __init__(self, local_dem: Path) -> None:
        self._local = CopernicusTerrainTiles(local_dem)
        self._client = httpx.Client(
            timeout=10,
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=32),
        )
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
        parent_x = x >> shift
        parent_y = y >> shift
        response = self._client.get(MAPTERHORN_URL.format(z=source_z, x=parent_x, y=parent_y))
        response.raise_for_status()
        with MemoryFile(response.content) as memory, memory.open() as source:
            tile_size = source.width / 2**shift
            window = Window(
                (x % 2**shift) * tile_size, (y % 2**shift) * tile_size, tile_size, tile_size
            )
            rgb = source.read(
                [1, 2, 3],
                window=window,
                out_shape=(3, 256, 256),
                resampling=Resampling.bilinear,
            ).astype(np.float32)
        return cast(np.ndarray, rgb[0] * 256 + rgb[1] + rgb[2] / 256 - 32768)
