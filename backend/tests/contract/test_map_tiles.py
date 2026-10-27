from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.application.use_cases.get_map_tile import GetMapTile
from hotel_agent.interfaces.http.routers.map_tiles import build_router


class Tiles:
    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self, z: int, x: int, y: int) -> bytes:
        self.calls += 1
        return b"tile" if z else b""


def test_versioned_tiles_cache_and_old_versions_do_not_read_storage() -> None:
    tiles = Tiles()
    app = FastAPI()
    app.include_router(build_router(cast(GetMapTile, tiles)))
    with TestClient(app) as client:
        response = client.get("/map/tiles/12/2499/1495.pbf?v=lod-v3")
        assert response.content == b"tile"
        assert response.headers["content-type"] == "application/vnd.mapbox-vector-tile"
        assert response.headers["x-map-tile-version"] == "lod-v3"
        assert response.headers["cache-control"] == "public, max-age=86400"
        assert client.get("/map/tiles/12/2499/1495.pbf?v=old").status_code == 409
        assert tiles.calls == 1
        unversioned = client.get("/map/tiles/12/2499/1495.pbf")
        assert unversioned.status_code == 200
        assert unversioned.headers["cache-control"] == "no-cache"
        empty = client.get("/map/tiles/0/0/0.pbf?v=lod-v3")
        assert empty.content == b""
        assert empty.headers["cache-control"] == "no-cache"
        assert client.get("/map/tiles/2/4/4.pbf?v=lod-v3").status_code == 404
