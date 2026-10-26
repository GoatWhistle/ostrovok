from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.view_assessment import NearbyViewAssessment
from hotel_agent.application.dto import BuildingRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


async def test_known_neighbor_obstructs_ray_and_unknown_height_stays_unknown() -> None:
    geometry: dict[str, Any] = {
        "type": "Polygon",
        "coordinates": [
            [
                [39.7205, 43.5799],
                [39.7206, 43.5799],
                [39.7206, 43.5801],
                [39.7205, 43.5801],
                [39.7205, 43.5799],
            ]
        ],
    }
    buildings = [
        BuildingRecord(
            id="known", geometry=geometry, height_m=30, levels=10, height_estimated=False
        ),
        BuildingRecord(
            id="unknown", geometry=geometry, height_m=3.2, levels=None, height_estimated=True
        ),
    ]
    repo = SimpleNamespace(list_context_buildings=AsyncMock(return_value=buildings))

    @asynccontextmanager
    async def uow() -> AsyncIterator[SimpleNamespace]:
        yield SimpleNamespace(search=repo)

    terrain = SimpleNamespace(sample_points=lambda points: {key: 100.0 for key in points})
    view = NearbyViewAssessment(cast(CountryTerrainTiles, terrain), cast(UnitOfWorkFactory, uow))
    result = await view.assess({"hotel": (39.72, 43.58)}, 90, 10, 500)

    assert result["hotel"]["horizon_angle_deg"] > 20
    assert result["hotel"]["known_building_obstacles"] == 1
    assert result["hotel"]["unknown_building_heights"] == 1
    assert result["hotel"]["terrain_samples"] == 16


async def test_missing_ground_height_does_not_prove_an_unobstructed_view() -> None:
    @asynccontextmanager
    async def uow() -> AsyncIterator[SimpleNamespace]:
        yield SimpleNamespace(
            search=SimpleNamespace(list_context_buildings=AsyncMock(return_value=[]))
        )

    terrain = SimpleNamespace(sample_points=lambda points: {})
    view = NearbyViewAssessment(cast(CountryTerrainTiles, terrain), cast(UnitOfWorkFactory, uow))
    assert await view.assess({"hotel": (39.72, 43.58)}, 90, 10, 500) == {}
