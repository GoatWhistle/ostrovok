from datetime import UTC, datetime

import pytest

from hotel_agent.adapters.geo.window_views import WindowViews
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.view_scenes import PathBuildings, SceneBuilding
from tests.unit.adapters.test_window_views import FlatTerrain, Geometry, hotel, request


@pytest.mark.parametrize(
    "truncated,complete_path,visible",
    [(False, False, True), (True, False, False), (True, True, True)],
)
async def test_verified_corridor_avoids_unavailable_surrounding_cells(
    truncated: bool, complete_path: bool, visible: bool
) -> None:
    geometry = Geometry(complete=False)
    engine = WindowViews(FlatTerrain(), geometry)
    prepared = await engine.prepare(
        (hotel(),),
        request(20),
        {"h1": NamedPlaceRecord(id="n20", name="Башня", location=(39.01, 43))},
        {},
    )
    rows = (
        SceneBuilding(
            geometry.blocker.id, geometry.blocker.geometry, geometry.blocker.tags, 30, None
        ),
    )
    buildings = PathBuildings(
        {ray.id: rows for ray in prepared.rays},
        truncated,
        {ray.id: "https://example.org/verified-extract" for ray in prepared.rays},
        frozenset(ray.id for ray in prepared.rays) if complete_path else frozenset({"other"}),
    )
    result = await engine.evaluate(prepared, buildings, datetime(2026, 10, 26, tzinfo=UTC))
    assert (result.facts[0].value is True) is visible
    assert result.facts[0].qualifiers["visibility"]["complete_coverage"] is visible
    assert geometry.area_calls == 0
