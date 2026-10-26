from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from hotel_agent.adapters.geo.worldcover import WorldCover, tile_name
from hotel_agent.application.ports.place_research import PlaceResearchRequest


@pytest.mark.parametrize(
    "lon,lat,name", [(39.72, 43.58, "N42E039"), (-1, -1, "S03W003"), (180 - 0.01, 60, "N60E177")]
)
def test_tile_uses_lower_left_three_degree_origin(lon: float, lat: float, name: str) -> None:
    assert tile_name(lon, lat) == name


@pytest.mark.parametrize("code,expected", [(10, 100), (80, 0), (0, None)])
async def test_local_cog_classification_and_nodata(
    tmp_path: Path, code: int, expected: int | None
) -> None:
    path = tmp_path / "ESA_WorldCover_10m_2021_v200_N42E039_Map.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=100,
        height=100,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        nodata=0,
        transform=from_origin(39, 45, 0.03, 0.03),
    ) as dataset:
        dataset.write(np.full((1, 100, 100), code, dtype="uint8"))
    result = await WorldCover(tmp_path).research(PlaceResearchRequest((39.72, 43.58), 500))
    if expected is None:
        assert not result.values
    else:
        assert result.values["trees_sample_pct"] == expected
        assert "2021" in result.descriptions["trees_sample_pct"]
    assert "CC BY" in result.note


async def test_missing_tile_is_unknown_and_polar_region_is_rejected(tmp_path: Path) -> None:
    provider = WorldCover(tmp_path)
    with pytest.raises(ValueError, match="unavailable"):
        await provider.research(PlaceResearchRequest((39.72, 43.58), 500))
    with pytest.raises(ValueError, match="latitude"):
        await provider.research(PlaceResearchRequest((39.72, 83), 500))
