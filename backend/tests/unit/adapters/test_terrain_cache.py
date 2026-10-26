from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import httpx
import numpy as np
import pytest
from rasterio.io import MemoryFile

from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.terrain_cache import TerrainSourceCache
from hotel_agent.domain.errors import TerrainNotFound


def test_children_and_concurrent_callers_share_parent_download(tmp_path: Path) -> None:
    with MemoryFile() as memory:
        with memory.open(driver="GTiff", width=256, height=256, count=3, dtype="uint8") as image:
            image.write(np.full((3, 256, 256), 128, dtype=np.uint8))
        data = memory.read()
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        return httpx.Response(200, content=data)

    transport_client = httpx.Client(transport=httpx.MockTransport(handle))
    with patch(
        "hotel_agent.adapters.geo.country_terrain.httpx.Client", return_value=transport_client
    ):
        terrain = CountryTerrainTiles(tmp_path / "missing.tif")
        with ThreadPoolExecutor(max_workers=4) as workers:
            tiles = list(workers.map(lambda x: terrain.render(14, x, 8000), range(10000, 10004)))
        assert all(tile.startswith(b"\x89PNG") for tile in tiles)
        assert len(requests) == 1
        terrain.close()


def test_missing_parent_is_cached_without_inventing_elevation(tmp_path: Path) -> None:
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        return httpx.Response(404)

    transport_client = httpx.Client(transport=httpx.MockTransport(handle))
    with patch(
        "hotel_agent.adapters.geo.country_terrain.httpx.Client", return_value=transport_client
    ):
        terrain = CountryTerrainTiles(tmp_path / "missing.tif")
        for x in (10000, 10001):
            with pytest.raises(TerrainNotFound):
                terrain.render(14, x, 8000)
        assert len(requests) == 1
        terrain.close()


def test_parent_cache_survives_adapter_restart(tmp_path: Path) -> None:
    calls = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, content=b"source tile")

    client = httpx.Client(transport=httpx.MockTransport(handle))
    cache = TerrainSourceCache(client, tmp_path / "cache")
    assert cache.get("https://example.org/tile.webp", 12, 10, 20) == b"source tile"
    cache.close()
    restored = TerrainSourceCache(client, tmp_path / "cache")
    assert restored.get("https://example.org/tile.webp", 12, 10, 20) == b"source tile"
    assert len(calls) == 1
    client.close()


def test_terrain_enlargement_does_not_create_spikes_at_rgb_byte_boundaries(tmp_path: Path) -> None:
    rgb = np.zeros((3, 256, 256), dtype=np.uint8)
    rgb[0, :, :128] = 127
    rgb[1, :, :128] = 255
    rgb[0, :, 128:] = 128
    with MemoryFile() as memory:
        with memory.open(driver="GTiff", width=256, height=256, count=3, dtype="uint8") as image:
            image.write(rgb)
        source = memory.read()
    client = httpx.Client(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, content=source))
    )
    with patch("hotel_agent.adapters.geo.country_terrain.httpx.Client", return_value=client):
        terrain = CountryTerrainTiles(tmp_path / "missing.tif")
        for x in (10001, 10002):
            data = terrain.render(14, x, 8000)
            with MemoryFile(data) as memory, memory.open() as image:
                encoded = image.read().astype(np.float64)
            heights = (encoded[0] * 65536 + encoded[1] * 256 + encoded[2]) / 10 - 10000
            assert float(heights.min()) >= -1.01
            assert float(heights.max()) <= 0.01
        terrain.close()
