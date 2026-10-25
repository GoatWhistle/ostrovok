from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from rasterio.warp import reproject

ORIGIN = 20_037_508.342789244
SIZE = 256


class CopernicusTerrainTiles:
    def __init__(self, dem_path: Path) -> None:
        self._dem_path = dem_path

    def render(self, z: int, x: int, y: int) -> bytes:
        return render_tile(str(self._dem_path), z, x, y)

    def render_relief(self, z: int, x: int, y: int) -> bytes:
        return relief_tile(str(self._dem_path), z, x, y)


@lru_cache(maxsize=512)
def render_tile(dem_path: str, z: int, x: int, y: int) -> bytes:
    heights = read_heights(dem_path, z, x, y)
    encoded = np.clip(np.rint((heights + 10_000) * 10), 0, 16_777_215).astype(np.uint32)
    channels = np.stack(
        ((encoded >> 16) & 255, (encoded >> 8) & 255, encoded & 255), axis=0
    ).astype(np.uint8)
    return png(channels)


@lru_cache(maxsize=512)
def relief_tile(dem_path: str, z: int, x: int, y: int) -> bytes:
    heights = read_heights(dem_path, z, x, y)
    stops = [-10, 0, 1, 80, 350, 900, 1800]
    red = [14, 14, 221, 206, 152, 116, 234]
    green = [67, 67, 211, 205, 166, 136, 230]
    blue = [84, 84, 181, 174, 137, 129, 215]
    channels = np.stack(
        [np.interp(heights, stops, channel).astype(np.uint8) for channel in (red, green, blue)],
        axis=0,
    )
    return png(channels)


@lru_cache(maxsize=256)
def read_heights(dem_path: str, z: int, x: int, y: int) -> np.ndarray:
    span = 2 * ORIGIN / 2**z
    west = -ORIGIN + x * span
    east = west + span
    north = ORIGIN - y * span
    south = north - span
    heights = np.zeros((SIZE, SIZE), dtype=np.float32)
    with rasterio.open(dem_path) as source:
        reproject(
            source=rasterio.band(source, 1),
            destination=heights,
            src_transform=source.transform,
            src_crs=source.crs,
            dst_transform=from_bounds(west, south, east, north, SIZE, SIZE),
            dst_crs="EPSG:3857",
            resampling=Resampling.bilinear,
            src_nodata=source.nodata,
            dst_nodata=0,
        )
    heights = np.nan_to_num(heights, nan=0.0)
    return heights


def png(channels: np.ndarray) -> bytes:
    with MemoryFile() as memory:
        with memory.open(
            driver="PNG",
            width=SIZE,
            height=SIZE,
            count=3,
            dtype="uint8",
        ) as tile:
            tile.write(channels)
        return bytes(memory.read())
