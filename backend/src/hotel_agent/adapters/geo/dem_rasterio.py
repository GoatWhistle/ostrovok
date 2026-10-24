from collections.abc import Sequence
from contextlib import ExitStack
from pathlib import Path

import rasterio
from rasterio.merge import merge

from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import BBox

PROFILE = {
    "driver": "GTiff",
    "compress": "deflate",
    "predictor": 3,
    "zlevel": 9,
    "tiled": True,
    "blockxsize": 256,
    "blockysize": 256,
}


class CopernicusElevationSource:
    def __init__(self, tiles: Sequence[Path], target: Path) -> None:
        self._tiles = tuple(tiles)
        self._target = target

    @property
    def description(self) -> str:
        return "dem:Copernicus GLO-30 " + ", ".join(tile.name for tile in self._tiles)

    def crop(self, bbox: BBox) -> dict[str, object]:
        return crop(self._tiles, bbox, self._target)


def crop(tiles: Sequence[Path], bbox: BBox, target: Path) -> dict[str, object]:
    if not tiles:
        raise InvalidValue("No DEM tiles given")
    with ExitStack() as stack:
        sources = [stack.enter_context(rasterio.open(tile)) for tile in tiles]
        mosaic, transform = merge(sources, bounds=bbox.as_tuple())
        crs = sources[0].crs
        nodata = sources[0].nodata
    band = mosaic[0]
    target.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        target,
        "w",
        height=band.shape[0],
        width=band.shape[1],
        count=1,
        dtype=band.dtype,
        crs=crs,
        transform=transform,
        nodata=nodata,
        **PROFILE,
    ) as sink:
        sink.write(band, 1)
    return {
        "bytes": target.stat().st_size,
        "width": band.shape[1],
        "height": band.shape[0],
        "dtype": str(band.dtype),
        "crs": str(crs),
        "min_m": round(float(band.min()), 2),
        "max_m": round(float(band.max()), 2),
    }


class RasterioElevation:
    def __init__(self, path: Path) -> None:
        self._dataset = rasterio.open(path)

    def at(self, lon: float, lat: float) -> float | None:
        if not self._contains(lon, lat):
            return None
        [value] = self._dataset.sample([(lon, lat)], 1)
        height = float(value[0])
        nodata = self._dataset.nodata
        if nodata is not None and height == float(nodata):
            return None
        return round(height, 2)

    def close(self) -> None:
        self._dataset.close()

    def _contains(self, lon: float, lat: float) -> bool:
        bounds = self._dataset.bounds
        return bool(bounds.left <= lon <= bounds.right and bounds.bottom <= lat <= bounds.top)
