from collections.abc import Mapping
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

import pytest

from hotel_agent.adapters.geo.window_views import WindowViews
from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.elevation import ElevationPort
from hotel_agent.application.ports.view_geometry import PhysicalArea, PhysicalObject
from hotel_agent.application.ports.view_scenes import PathBuildings, SceneBuilding
from hotel_agent.application.ports.window_views import WindowEvidence
from hotel_agent.application.spatial_matching import spatial_intent
from hotel_agent.domain.query import SpatialRequest
from hotel_agent.domain.services.scoring import MatchQuality, match


def square(lon: float, half_width: float = 0.0001) -> dict[str, Any]:
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [lon - half_width, 43 - half_width],
                [lon + half_width, 43 - half_width],
                [lon + half_width, 43 + half_width],
                [lon - half_width, 43 + half_width],
                [lon - half_width, 43 - half_width],
            ]
        ],
    }


class FlatTerrain:
    def sample_points(self, points: Mapping[str, tuple[float, float]]) -> dict[str, float]:
        return {key: 0.0 for key in points}


class Geometry:
    def __init__(self, blocker_height: str | None = "30", complete: bool = True) -> None:
        self.complete = complete
        self.area_calls = 0
        self.target = PhysicalObject(
            "n20",
            {"name": "Башня", "height": "40", "man_made": "tower"},
            {"type": "Point", "coordinates": [39.01, 43]},
            "https://www.openstreetmap.org/node/20",
        )
        self.blocker = PhysicalObject(
            "w30",
            {"building": "yes", **({"height": blocker_height} if blocker_height else {})},
            square(39.005),
            "https://www.openstreetmap.org/way/30",
        )

    async def object(self, identifier: str) -> PhysicalObject | None:
        return self.target if identifier == self.target.id else None

    async def area(self, bbox: tuple[float, float, float, float]) -> PhysicalArea:
        self.area_calls += 1
        return PhysicalArea(bbox, (self.blocker,), self.complete, "https://www.openstreetmap.org")


def hotel() -> SearchHotelRecord:
    return SearchHotelRecord(
        id="h1",
        region_id="sochi",
        name="Отель",
        location=(39, 43),
        stars=4,
        building_id="w10",
        height_m=60,
        levels=20,
        footprint=square(39),
    )


async def compute(
    request: SpatialRequest, geometry: Geometry | None = None, terrain: ElevationPort | None = None
) -> WindowEvidence:
    engine = WindowViews(terrain or FlatTerrain(), geometry or Geometry())
    building = SceneBuilding(
        "w10", square(39), {"building": "hotel", "height": "60", "building:levels": "20"}, 60, 20
    )
    prepared = await engine.prepare(
        (hotel(),),
        request,
        {"h1": NamedPlaceRecord(id="n20", name="Башня", location=(39.01, 43))},
        {"h1": building},
    )
    return await engine.evaluate(
        prepared, PathBuildings({}, False), datetime(2026, 10, 26, tzinfo=UTC)
    )


def request(floor: int | None = None, direction: float | None = None) -> SpatialRequest:
    return SpatialRequest(
        kind="landmark_view",
        target="Башня",
        radius_m=2000,
        source_text="вид на башню",
        floor_min=floor,
        floor_max=floor,
        facade_azimuth_deg=direction,
    )


async def test_real_facade_ray_is_blocked_on_low_floor_and_clear_on_high_floor() -> None:
    low, high = await compute(request(1)), await compute(request(15))
    assert low.facts[0].value is False
    assert high.facts[0].value is True
    for outcome, status in ((low, "blocked"), (high, "visible")):
        fact = outcome.facts[0]
        visibility = fact.qualifiers["visibility"]
        assert visibility["status"] == status
        assert visibility["target_id"] == "n20"
        assert visibility["distance_m"] > 800
        assert visibility["complete_coverage"]
        assert visibility["profile"]
        assert len(outcome.features) >= 3
        assert visibility["observer_location"][0] > 39.0001
        assert visibility["bookable_room_confirmed"] is False
    assert low.facts[0].qualifiers["visibility"]["blockers"][0]["id"] == "w30"
    assert (
        match(
            spatial_intent(request(15)),
            fact_from_record(high.facts[0]),
            datetime(2026, 10, 26, tzinfo=UTC),
        ).quality
        is MatchQuality.PARTIAL
    )


async def test_unspecified_floor_selects_first_computed_clear_floor() -> None:
    result = await compute(request())
    fact = result.facts[0]
    assert fact.value is True
    level = fact.qualifiers["visibility"]["floor"]
    assert 1 < level < 20
    lower = await compute(request(level - 1))
    assert lower.facts[0].value is not True


@pytest.mark.parametrize("missing", ["height", "coverage"])
async def test_missing_sources_stay_unknown_instead_of_becoming_clear(missing: str) -> None:
    result = await compute(
        request(15), Geometry(None if missing == "height" else "30", missing != "coverage")
    )
    assert result.facts[0].value is None
    assert result.facts[0].qualifiers["visibility"]["status"] == "unknown"
    assert result.facts[0].qualifiers["visibility"]["missing"]


@pytest.mark.parametrize("wanted", [request(99), request(1, 270)])
async def test_impossible_floor_or_opposite_windows_are_rejected(wanted: SpatialRequest) -> None:
    result = await compute(wanted)
    assert result.facts[0].value is False
    assert result.facts[0].qualifiers["visibility"]["status"] == "blocked"
    assert result.facts[0].explanation
    assert result.features == ()


class MissingTerrain:
    def sample_points(self, points: Mapping[str, tuple[float, float]]) -> dict[str, float]:
        return {}


async def test_missing_observer_or_target_dem_preserves_the_specific_source_failure() -> None:
    result = await compute(request(), terrain=MissingTerrain())
    fact = result.facts[0]
    assert fact.value is None
    assert fact.qualifiers["visibility"]["status"] == "unknown"
    assert "рельефа" in fact.qualifiers["visibility"]["reason"]
    assert result.features == ()


async def test_whole_object_request_still_computes_partial_evidence_without_promising_full_view() -> (
    None
):
    wanted = replace(request(15), target_part="whole")
    result = await compute(wanted)
    fact = result.facts[0]
    assert fact.value is None
    assert fact.qualifiers["visibility"]["status"] == "unknown"
    assert fact.qualifiers["visibility"]["sampled_line_status"] == "visible"
    assert fact.qualifiers["visibility"]["entire_target_verified"] is False
    assert fact.qualifiers["visibility"]["requested_target_scope"] == "whole"
    assert "полный обзор всего объекта не подтверждён" in fact.explanation
    assert result.features
    assert (
        match(
            spatial_intent(wanted), fact_from_record(fact), datetime(2026, 10, 26, tzinfo=UTC)
        ).quality
        is MatchQuality.UNKNOWN
    )


@pytest.mark.parametrize("height, expected", [("1", True), ("1500", False), (None, None)])
async def test_long_view_loads_entire_corridor_without_exhausting_cell_budget(
    height: str | None, expected: bool | None
) -> None:
    geometry = Geometry(blocker_height=height)
    geometry.target = PhysicalObject(
        "n20",
        {"name": "Дальний ориентир", "height": "1000"},
        {"type": "Point", "coordinates": [39.9, 43]},
        "test:distant",
    )
    result = await compute(replace(request(15), radius_m=100000), geometry)
    visibility = result.facts[0].qualifiers["visibility"]
    assert visibility["complete_coverage"] is True
    assert result.facts[0].value is expected


async def test_unknown_target_height_is_explained_as_missing_data() -> None:
    geometry = Geometry()
    geometry.target = replace(geometry.target, tags={"name": "Башня", "man_made": "tower"})
    evidence = await compute(request(floor=1), geometry)
    fact = evidence.facts[0]
    assert fact.value is None
    assert "высота ориентира или его выбранной части" in fact.qualifiers["visibility"]["missing"]
