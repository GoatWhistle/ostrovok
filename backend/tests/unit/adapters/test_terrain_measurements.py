from pathlib import Path
from types import SimpleNamespace
from typing import cast

import httpx
import numpy as np
import rasterio
from rasterio.transform import from_origin

from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.terrain_measurements import TerrainMeasurements
from hotel_agent.adapters.geo.terrain_sampling import sample_points


async def test_height_zero_is_valid_and_missing_samples_do_not_prove_flat_terrain() -> None:
    def samples(points: object) -> dict[str, float]:
        return {
            **{f"flat:{index}": 0 for index in range(9)},
            "peak:0": 1500,
            **{f"peak:{index}": 1400 + index * 25 for index in range(1, 9)},
            "partial:0": 1000,
            "partial:1": 950,
        }

    tiles = cast(CountryTerrainTiles, SimpleNamespace(sample_points=samples))
    measured = await TerrainMeasurements(tiles).measure(
        {"flat": (44.6, 43), "peak": (44.7, 42.9), "partial": (44.5, 42.9), "missing": (44.4, 43)},
        1000,
    )

    assert measured["flat"] == {"elevation_m": 0, "relief_m": 0}
    assert measured["peak"] == {"elevation_m": 1500, "relief_m": 175}
    assert measured["partial"] == {"elevation_m": 1000}
    assert "missing" not in measured


def test_available_local_dem_is_sampled_without_network(tmp_path: Path) -> None:
    path = tmp_path / "dem.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=2,
        height=2,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_origin(44, 44, 1, 1),
    ) as dem:
        dem.write(np.array([[500, 600], [1000, 1500]], dtype=np.float32), 1)

    def network(z: int, x: int, y: int) -> np.ndarray:
        raise AssertionError("A local DEM must not call the remote source")

    measured = sample_points({"first": (44.5, 43.5), "second": (45.5, 42.5)}, path, network)

    assert measured == {"first": 500, "second": 1500}


def test_unavailable_remote_tile_returns_no_measurement(tmp_path: Path) -> None:
    def network(z: int, x: int, y: int) -> np.ndarray:
        raise httpx.ConnectError("offline")

    assert sample_points({"hotel": (44.5, 43.5)}, tmp_path / "missing.tif", network) == {}
