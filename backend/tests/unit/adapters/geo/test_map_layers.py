from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from shapely.geometry import Point, shape

from hotel_agent.adapters.geo.overpass_layers import map_features
from hotel_agent.adapters.geo.sea_polygon import sea_polygon
from hotel_agent.application.dto import Feature


def test_multipolygon_preserves_holes_and_clips_to_sochi() -> None:
    outer = [(39.5, 43.4), (39.7, 43.4), (39.7, 43.6), (39.5, 43.6), (39.5, 43.4)]
    inner = [(39.6, 43.45), (39.65, 43.45), (39.65, 43.5), (39.6, 43.5), (39.6, 43.45)]
    features = map_features(
        [
            {
                "type": "relation",
                "id": 1,
                "tags": {"type": "multipolygon", "natural": "water"},
                "members": [
                    {"role": role, "geometry": [{"lon": x, "lat": y} for x, y in ring]}
                    for role, ring in [("outer", outer), ("inner", inner)]
                ],
            }
        ]
    )
    polygon = shape(features[0].geometry)
    assert polygon.bounds[0] == 39.55
    assert not polygon.covers(Point(39.625, 43.475))
    assert polygon.covers(Point(39.57, 43.475))
    assert features[0].id == "r1"


def test_coast_orientation_builds_sea_on_the_right_and_checks_dem(tmp_path: Path) -> None:
    dem = tmp_path / "dem.tif"
    heights = np.zeros((10, 10), dtype=np.float32)
    heights[:, :5] = 100
    with rasterio.open(
        dem,
        "w",
        driver="GTiff",
        width=10,
        height=10,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(0, 0, 2, 2, 10, 10),
    ) as out:
        out.write(heights, 1)
    coastline = Feature(
        id="coast", geometry={"type": "LineString", "coordinates": [[1, 0], [1, 2]]}, properties={}
    )
    sea, evidence = sea_polygon([coastline], (0, 0, 2, 2), dem)
    assert shape(sea.geometry).covers(Point(1.5, 1))
    assert not shape(sea.geometry).covers(Point(0.5, 1))
    assert evidence["sea_pieces"] == 1
    reversed_coast = Feature(
        id="reverse",
        geometry={"type": "LineString", "coordinates": [[1, 2], [1, 0]]},
        properties={},
    )
    with pytest.raises(ValueError, match="DEM"):
        sea_polygon([reversed_coast], (0, 0, 2, 2), dem)
