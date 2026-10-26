from dataclasses import replace

import pytest

from hotel_agent.domain.visibility import ElevationRange, RayObstacle, sightline


def test_shared_ground_error_is_not_counted_twice_for_the_same_object() -> None:
    obstacle = RayObstacle(
        "same-building",
        "building",
        60,
        ElevationRange(29, 33),
        shared_target_ground_span_m=4,
    )
    result = sightline(
        100,
        ElevationRange(5, 5),
        ElevationRange(49, 53),
        (obstacle,),
        complete_coverage=True,
        curvature_coefficient=0,
    )
    margins = [5 * 0.4 + (ground + 50) * 0.6 - (ground + 30) for ground in (-1, 0, 1, 2, 3)]
    assert result.minimum_clearance_m == pytest.approx(min(margins))
    assert result.status == "visible"
    unrelated = replace(obstacle, shared_target_ground_span_m=0)
    assert (
        sightline(
            100,
            ElevationRange(5, 5),
            ElevationRange(49, 53),
            (unrelated,),
            complete_coverage=True,
            curvature_coefficient=0,
        ).status
        == "unknown"
    )


def test_shared_ground_does_not_remove_actual_obstruction() -> None:
    obstacle = RayObstacle(
        "same-building", "building", 60, ElevationRange(39, 43), shared_target_ground_span_m=4
    )
    assert (
        sightline(
            100, ElevationRange(5, 5), ElevationRange(49, 53), (obstacle,), complete_coverage=True
        ).status
        == "blocked"
    )
