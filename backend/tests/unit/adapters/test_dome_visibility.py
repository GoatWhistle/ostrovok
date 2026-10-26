from dataclasses import replace
from math import sqrt
from typing import Any

import pytest
from pyproj import Transformer
from shapely import transform
from shapely.geometry import LineString, Point, mapping

from hotel_agent.adapters.geo.building_dimensions import building_dimensions
from hotel_agent.adapters.geo.roof_profile import dome_profile
from hotel_agent.adapters.geo.window_scene import obstacles, scene_samples
from hotel_agent.adapters.geo.window_targets import target_point
from hotel_agent.application.ports.view_geometry import PhysicalObject
from hotel_agent.application.ports.view_scenes import SceneBuilding
from hotel_agent.application.ports.window_views import WindowRay
from hotel_agent.application.visibility_records import FacadeObserver
from hotel_agent.domain.visibility import ElevationRange, sightline


def dome_scene(tags: dict[str, str]) -> tuple[WindowRay, SceneBuilding]:
    inverse = Transformer.from_crs(
        "+proj=aeqd +lat_0=60 +lon_0=30 +datum=WGS84 +units=m", 4326, always_xy=True
    )
    footprint: dict[str, Any] = mapping(
        transform(Point(70, 0).buffer(20, quad_segs=32), inverse.transform, interleaved=False)
    )
    target = PhysicalObject(
        "target",
        {"height": "50"},
        {"type": "Point", "coordinates": inverse.transform(100, 0)},
        "test",
    )
    ray = WindowRay(
        "ray",
        "hotel",
        FacadeObserver("window", (30, 60), 90, 10),
        building_dimensions({"height": "10"}),
        target,
        inverse.transform(100, 0),
        ElevationRange(50, 50),
        (1,),
    )
    return ray, SceneBuilding("dome", footprint, tags, None, None)


def compute(tags: dict[str, str], target_height: float = 50) -> str:
    ray, building = dome_scene(tags)
    samples = scene_samples(ray, (building,))
    profile = obstacles(samples, {key: 0 for key in samples.points})
    return sightline(
        samples.distance_m,
        ElevationRange(5, 5),
        ElevationRange(target_height, target_height),
        profile,
        complete_coverage=True,
    ).status


TAGS = {"height": "30", "roof:height": "20", "roof:shape": "dome"}


def test_ray_above_curved_roof_is_not_blocked_by_its_bounding_prism() -> None:
    assert compute(TAGS) == "visible"
    assert compute({**TAGS, "roof:shape": "flat"}) != "visible"


def test_actual_dome_still_blocks_a_lower_ray() -> None:
    assert compute(TAGS, 30) == "blocked"


@pytest.mark.parametrize("roof_height", ["", "unknown", "40", "-1"])
def test_missing_or_inconsistent_roof_dimensions_do_not_remove_obstruction(
    roof_height: str,
) -> None:
    assert compute({**TAGS, "roof:height": roof_height}) != "visible"


def test_dome_profile_checks_peak_even_when_crossing_midpoint_is_elsewhere() -> None:
    ray, building = dome_scene(TAGS)
    ray = replace(ray, target_location=(30.0015, 60.00008))
    samples = scene_samples(ray, (building,))
    profile = obstacles(samples, {key: 0 for key in samples.points})
    assert (
        max(
            p.elevation.maximum_m
            for p in profile
            if p.elevation and p.elevation.maximum_m is not None
        )
        > 30
    )


def test_single_part_multipolygon_uses_the_same_curved_roof_as_a_way() -> None:
    ray, building = dome_scene(TAGS)
    building = replace(
        building,
        geometry={"type": "MultiPolygon", "coordinates": [building.geometry["coordinates"]]},
    )
    samples = scene_samples(ray, (building,))
    profile = obstacles(samples, {key: 0 for key in samples.points})
    result = sightline(
        samples.distance_m,
        ElevationRange(5, 5),
        ElevationRange(50, 50),
        profile,
        complete_coverage=True,
    )
    assert result.status == "visible"
    assert any(p.geometry_model == "dome_envelope@1" for p in profile)


@pytest.mark.parametrize("offset", [0, 8, 19])
def test_interval_envelope_covers_continuous_hemisphere_between_samples(offset: float) -> None:
    polygon = Point(70, 0).buffer(20, quad_segs=32)
    line = LineString([(0, offset), (100, offset)])
    crossing = polygon.intersection(line)
    low, high = crossing.bounds[0], crossing.bounds[2]
    profile = dome_profile(polygon, line, low, high, TAGS)
    assert profile is not None
    for first, last in zip(profile[::2], profile[1::2], strict=True):
        for index in range(21):
            x = first.distance_m + (last.distance_m - first.distance_m) * index / 20
            true_height = 10 + sqrt(max(0, 400 - (x - 70) ** 2 - offset**2))
            assert 30 - first.drop.minimum_m >= true_height - 1e-8
            assert 30 - last.drop.minimum_m >= true_height - 1e-8


def test_dome_target_is_at_roof_apex_instead_of_float_above_nearest_edge() -> None:
    ray, building = dome_scene(TAGS)
    target = PhysicalObject("dome", TAGS, building.geometry, "test")
    point, height = target_point(target, ray.observer.location, top=True)
    project = Transformer.from_crs(
        4326, "+proj=aeqd +lat_0=60 +lon_0=30 +datum=WGS84 +units=m", always_xy=True
    )
    assert project.transform(*point) == pytest.approx((70, 0), abs=0.001)
    assert height == ElevationRange(30, 30)


def test_default_dome_view_targets_real_front_surface_height() -> None:
    ray, building = dome_scene(TAGS)
    target = PhysicalObject("dome", TAGS, building.geometry, "test")
    point, height = target_point(target, ray.observer.location)
    project = Transformer.from_crs(
        4326, "+proj=aeqd +lat_0=60 +lon_0=30 +datum=WGS84 +units=m", always_xy=True
    )
    assert project.transform(*point) == pytest.approx((50, 0), abs=0.001)
    assert height == ElevationRange(10, 10)


def test_roof_in_front_of_requested_apex_is_still_checked() -> None:
    ray, building = dome_scene(TAGS)
    target = PhysicalObject("dome", TAGS, building.geometry, "test")
    point, height = target_point(target, ray.observer.location, top=True)
    ray = replace(ray, target=target, target_location=point, target_height=height)
    samples = scene_samples(ray, (building,))
    profile = obstacles(samples, {key: 0 for key in samples.points})
    assert any(p.id == "dome" and p.geometry_model == "dome_envelope@1" for p in profile)
