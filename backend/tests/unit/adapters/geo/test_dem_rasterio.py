from pathlib import Path

import numpy
import pytest
import rasterio
from rasterio.transform import from_origin

from hotel_agent.adapters.geo.dem_rasterio import RasterioElevation, crop
from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import BBox

NODATA = -32767.0


def write_tile(path: Path, west: float, south: float, fill: float) -> Path:
    size, step = 10, 0.01
    band = numpy.full((size, size), fill, dtype="float32")
    band[0, 0] = NODATA
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=size,
        width=size,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_origin(west, south + size * step, step, step),
        nodata=NODATA,
    ) as sink:
        sink.write(band, 1)
    return path


def test_two_tiles_are_merged_and_cut_to_the_bbox(tmp_path: Path) -> None:
    left = write_tile(tmp_path / "left.tif", 39.0, 43.0, 100.0)
    right = write_tile(tmp_path / "right.tif", 39.1, 43.0, 200.0)
    target = tmp_path / "out" / "dem.tif"

    meta = crop([left, right], BBox(39.02, 43.02, 39.18, 43.08), target)

    assert target.is_file()
    assert meta["width"] == 16
    assert meta["height"] == 6
    assert meta["crs"] == "EPSG:4326"
    assert meta["dtype"] == "float32"
    written = meta["bytes"]
    assert isinstance(written, int) and written > 0


def test_cropping_without_tiles_is_refused(tmp_path: Path) -> None:
    with pytest.raises(InvalidValue, match="No DEM tiles"):
        crop([], BBox(39.0, 43.0, 39.1, 43.1), tmp_path / "dem.tif")


def test_elevation_is_sampled_inside_and_refused_outside(tmp_path: Path) -> None:
    tile = write_tile(tmp_path / "tile.tif", 39.0, 43.0, 137.5)

    dem = RasterioElevation(tile)
    try:
        assert dem.at(39.05, 43.05) == 137.5
        assert dem.at(41.0, 43.05) is None
        assert dem.at(39.05, 45.0) is None
    finally:
        dem.close()


def test_nodata_reads_as_unknown_rather_than_a_height(tmp_path: Path) -> None:
    tile = write_tile(tmp_path / "tile.tif", 39.0, 43.0, 137.5)

    dem = RasterioElevation(tile)
    try:
        assert dem.at(39.005, 43.095) is None
    finally:
        dem.close()
