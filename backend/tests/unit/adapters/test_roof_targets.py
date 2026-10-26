from dataclasses import replace

from hotel_agent.adapters.geo.window_scene import obstacles, scene_samples
from hotel_agent.adapters.geo.window_targets import target_points
from hotel_agent.application.ports.view_geometry import PhysicalObject
from hotel_agent.domain.visibility import ElevationRange, RayObstacle, sightline
from tests.unit.adapters.test_dome_visibility import TAGS, dome_scene


def test_visible_dome_shoulder_is_found_when_eave_and_apex_are_hidden() -> None:
    ray, building = dome_scene(TAGS)
    target = PhysicalObject("dome", TAGS, building.geometry, "test")
    results = []
    for location, height in target_points(target, ray.observer.location):
        candidate = replace(ray, target=target, target_location=location, target_height=height)
        samples = scene_samples(candidate, (building,))
        base = ElevationRange(-1, 3)
        profile = obstacles(samples, {key: 0.0 for key in samples.points}, target.id, base)
        assert height.maximum_m is not None
        target_height = ElevationRange(height.minimum_m - 1, height.maximum_m + 3)
        result = sightline(
            samples.distance_m,
            ElevationRange(5, 5),
            target_height,
            (*profile, RayObstacle("foreground", "building", 40, ElevationRange(10, 10))),
            complete_coverage=True,
        )
        results.append(result.status)
    assert results[0] != "visible"
    assert results[-1] != "visible"
    assert "visible" in results[1:-1]


def test_explicit_apex_does_not_substitute_visible_shoulder() -> None:
    ray, building = dome_scene(TAGS)
    target = PhysicalObject("dome", TAGS, building.geometry, "test")
    assert len(target_points(target, ray.observer.location, top=True)) == 1
