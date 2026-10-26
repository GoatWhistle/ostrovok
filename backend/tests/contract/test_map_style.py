from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Self, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.map_style.manifest_files import ManifestFiles
from hotel_agent.application.dto import RegionRecord
from hotel_agent.application.map_catalog import CATALOG_VERSION
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.application.use_cases.get_map_style import GetMapStyle
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.interfaces.http.routers import map_style

SEED = Path(__file__).resolve().parents[3] / "data" / "seed"


@dataclass
class Regions:
    async def list_loaded(self) -> list[RegionRecord]:
        return [
            RegionRecord(
                id=item,
                name=item,
                bbox=(39.5, 43.3, 40.0, 43.8),
                hotels_count=1,
                data_as_of=date(2026, 10, 26),
            )
            for item in ("sochi", "russia")
        ]


class Work:
    regions = Regions()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    ErrorHandlers(StdlibLogger("contract")).register(app)
    service = GetMapStyle(lambda: cast(UnitOfWork, Work()), ManifestFiles(SEED), CATALOG_VERSION)
    app.include_router(map_style.build_router(service))
    return TestClient(app)


def test_sochi_offers_local_versioned_assets(client: TestClient, validate: Any) -> None:
    response = client.get("/map/style", params={"region_id": "sochi"})
    assert response.status_code == 200
    body = response.json()
    validate("MapStyleManifest", body)
    assert body["available"] is True
    assert body["version"] in body["assets"]["basemap_url"]
    assert all(
        body["assets"][key].startswith(("/maps/sochi/", "/api/v1/map/"))
        for key in ("basemap_url", "glyphs_url", "sprite_url", "vector_tiles_url")
    )


def test_a_region_without_basemap_says_so(client: TestClient, validate: Any) -> None:
    body = client.get("/map/style", params={"region_id": "russia"}).json()
    validate("MapStyleManifest", body)
    assert body["available"] is False
    assert body["assets"] is None
    assert body["reason"] == "basemap_missing"


@pytest.mark.parametrize(("region", "status"), [("atlantis", 404), ("Sochi!", 422)])
def test_unknown_or_malformed_region(
    client: TestClient, validate: Any, region: str, status: int
) -> None:
    response = client.get("/map/style", params={"region_id": region})
    assert response.status_code == status
    validate("Error", response.json())
