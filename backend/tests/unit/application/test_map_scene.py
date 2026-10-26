from dataclasses import dataclass, field
from datetime import date
from typing import Any, Self, cast

import pytest

from hotel_agent.application.dto import RegionRecord
from hotel_agent.application.ports.map_scene import SceneBuildingRecord, SceneCandidates
from hotel_agent.application.ports.map_style import RegionMapRecord
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.application.use_cases.get_map_scene import GetMapScene, area_km2
from hotel_agent.domain.errors import InvalidQuery, MapVersionChanged, RegionNotFound

BBOX = "39.900,43.442,39.909,43.448"


def building(
    index: int, points: int = 5, height: float | None = 12.0, levels: int | None = None
) -> SceneBuildingRecord:
    return SceneBuildingRecord(
        id=f"b{index}",
        hotel_id=None,
        building_class="house",
        class_source="tag",
        height_m=height,
        levels=levels,
        height_source="tag" if height else "unknown",
        min_height_m=0.0,
        geometry={"type": "Polygon", "coordinates": []},
        points=points,
    )


@dataclass
class Scene:
    found: SceneCandidates
    calls: list[tuple[str, tuple[float, ...], int]] = field(default_factory=list)

    async def candidates(self, region: str, bbox: Any, limit: int) -> SceneCandidates:
        self.calls.append((region, bbox, limit))
        return self.found


class Regions:
    async def list_loaded(self) -> list[RegionRecord]:
        return [
            RegionRecord(
                id="sochi",
                name="Сочи",
                bbox=(39.5, 43.3, 40.0, 43.8),
                hotels_count=1,
                data_as_of=date(2026, 10, 26),
            )
        ]


class Files:
    def region(self, region_id: str) -> RegionMapRecord:
        return RegionMapRecord(basemap=None, tiles_version="osm-1", terrain=True)


def service(found: SceneCandidates) -> tuple[GetMapScene, Scene]:
    scene = Scene(found)

    class Work:
        regions = Regions()
        map_scene = scene

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *exc: object) -> None:
            return None

    return GetMapScene(lambda: cast(UnitOfWork, Work()), Files()), scene


@pytest.mark.parametrize(
    ("bbox", "zoom"),
    [
        ("1,2,3", 16),
        ("39.9,43.4,39.8,43.5", 16),
        ("x,1,2,3", 16),
        (BBOX, 15.9),
        (BBOX, 19.5),
        ("39.5,43.3,39.6,43.4", 16),
    ],
)
async def test_invalid_requests_are_rejected(bbox: str, zoom: float) -> None:
    get, scene = service(SceneCandidates(eligible=0, buildings=()))
    with pytest.raises(InvalidQuery):
        await get("sochi", bbox, zoom, None)
    assert scene.calls == []


async def test_unknown_region_and_changed_version() -> None:
    get, _ = service(SceneCandidates(eligible=0, buildings=()))
    with pytest.raises(RegionNotFound):
        await get("atlantis", BBOX, 16, None)
    with pytest.raises(MapVersionChanged):
        await get("sochi", BBOX, 16, "osm-0")
    assert (await get("sochi", BBOX, 16, "osm-1")).version == "osm-1"


async def test_selection_keeps_order_skips_complex_shapes_and_marks_truncation() -> None:
    found = SceneCandidates(
        eligible=4,
        buildings=(
            building(1),
            building(2, points=6000),
            building(3, height=None, levels=4),
            building(4, height=None),
        ),
    )
    get, _ = service(found)
    result = await get("sochi", BBOX, 17, None)
    assert [item.record.id for item in result.buildings] == ["b1", "b3", "b4"]
    assert [(item.render_height_m, item.height_estimated) for item in result.buildings] == [
        (12.0, False),
        (12.8, True),
        (6.4, True),
    ]
    assert result.truncated is False
    assert result.eligible_count == 4


async def test_vertex_budget_truncates_deterministically() -> None:
    found = SceneCandidates(
        eligible=30, buildings=tuple(building(index, points=4_000) for index in range(30))
    )
    get, _ = service(found)
    result = await get("sochi", BBOX, 18, None)
    assert len(result.buildings) == 25
    assert result.truncated is True


def test_area_is_measured_in_square_kilometres() -> None:
    assert 0.48 < area_km2((39.900, 43.442, 39.909, 43.448)) < 0.49
