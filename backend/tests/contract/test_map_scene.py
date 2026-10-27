from datetime import date
from pathlib import Path
from typing import Any, Self, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.map_style.manifest_files import ManifestFiles
from hotel_agent.application.dto import RegionRecord
from hotel_agent.application.ports.map_scene import SceneBuildingRecord, SceneCandidates
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.application.use_cases.get_map_scene import GetMapScene
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.interfaces.http.routers import map_scene

SEED = Path(__file__).resolve().parents[3] / "data" / "seed"
RING = [[39.9, 43.44], [39.901, 43.44], [39.901, 43.441], [39.9, 43.44]]


class Regions:
    async def list_loaded(self) -> list[RegionRecord]:
        return [
            RegionRecord(
                id="sochi",
                name="Сочи",
                bbox=(39.55, 43.35, 40.0, 43.75),
                hotels_count=1,
                data_as_of=date(2026, 10, 26),
            )
        ]


class Scene:
    async def candidates(self, region: str, bbox: Any, limit: int) -> SceneCandidates:
        record = SceneBuildingRecord(
            id="w1",
            hotel_id=None,
            building_class="house",
            class_source="tag",
            height_m=None,
            levels=None,
            height_source="unknown",
            min_height_m=0.0,
            geometry={"type": "MultiPolygon", "coordinates": [[RING]]},
            points=4,
        )
        return SceneCandidates(eligible=1, buildings=(record,))


class Work:
    regions = Regions()
    map_scene = Scene()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    ErrorHandlers(StdlibLogger("contract")).register(app)
    app.include_router(
        map_scene.build_router(GetMapScene(lambda: cast(UnitOfWork, Work()), ManifestFiles(SEED)))
    )
    return TestClient(app)


def test_scene_matches_the_contract(client: TestClient, validate: Any) -> None:
    response = client.get(
        "/map/scene",
        params={"region_id": "sochi", "bbox": "39.900,43.442,39.909,43.448", "zoom": 17},
    )
    assert response.status_code == 200
    body = response.json()
    validate("MapRenderScene", body)
    properties = body["features"][0]["properties"]
    assert properties["height_m"] is None
    assert properties["height_estimated"] is True
    assert properties["render_height_m"] == 6.4


@pytest.mark.parametrize(
    ("params", "status", "code"),
    [
        ({"region_id": "sochi", "bbox": "39.9,43.4,39.95,43.45", "zoom": 17}, 422, "invalid_query"),
        (
            {"region_id": "sochi", "bbox": "39.900,43.442,39.909,43.448", "zoom": 12},
            422,
            "invalid_query",
        ),
        (
            {"region_id": "atlantis", "bbox": "39.900,43.442,39.909,43.448", "zoom": 17},
            404,
            "not_found",
        ),
        (
            {"region_id": "sochi", "bbox": "39.900,43.442,39.909,43.448", "zoom": 17, "v": "old"},
            409,
            "map_version_changed",
        ),
    ],
)
def test_scene_errors(
    client: TestClient, validate: Any, params: dict[str, Any], status: int, code: str
) -> None:
    response = client.get("/map/scene", params=params)
    assert response.status_code == status
    validate("Error", response.json())
    assert response.json()["code"] == code
