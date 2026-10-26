import pytest

from hotel_agent.domain.visibility import EARTH_RADIUS_M, ElevationRange, RayObstacle, sightline


def height(value: float) -> ElevationRange:
    return ElevationRange(value, value)


def test_building_beyond_500_m_blocks_named_target_and_higher_floor_clears_it() -> None:
    obstacles = (RayObstacle("far-building", "building", 3000, height(40)),)
    blocked = sightline(5000, height(20), height(50), obstacles, complete_coverage=True)
    visible = sightline(5000, height(50), height(50), obstacles, complete_coverage=True)
    assert blocked.status == "blocked"
    assert blocked.blockers[0].id == "far-building"
    assert blocked.blockers[0].distance_m == 3000
    assert visible.status == "visible"
    expected = (40 + (6 / 7) * 3000 * 2000 / (2 * EARTH_RADIUS_M) + 0.2 - 50 * 0.6) / 0.4
    assert visible.required_observer_elevation_m == pytest.approx(expected)


def test_ridge_blocks_even_if_no_buildings_exist() -> None:
    result = sightline(
        2000,
        height(100),
        height(110),
        (RayObstacle("ridge", "terrain", 1200, height(180)),),
        complete_coverage=True,
    )
    assert result.status == "blocked"
    assert result.blockers[0].kind == "terrain"


def test_unknown_height_or_missing_dem_cannot_prove_an_unobstructed_view() -> None:
    for elevation in (None, ElevationRange(0, None)):
        result = sightline(
            1000,
            height(50),
            height(50),
            (RayObstacle("missing", "building", 400, elevation),),
            complete_coverage=True,
        )
        assert result.status == "unknown"
        assert result.required_observer_elevation_m is None


def test_missing_corridor_coverage_remains_unknown_even_when_known_samples_are_clear() -> None:
    result = sightline(
        1000,
        height(50),
        height(50),
        (RayObstacle("terrain", "terrain", 500, height(0)),),
        complete_coverage=False,
    )
    assert result.status == "unknown"


def test_known_obstruction_stays_blocked_despite_other_unknown_data() -> None:
    result = sightline(
        1000,
        height(5),
        height(5),
        (
            RayObstacle("known", "building", 300, height(30)),
            RayObstacle("unknown", "building", 700, None),
        ),
        complete_coverage=False,
    )
    assert result.status == "blocked"
    assert result.unknown_obstacles == 1


def test_height_uncertainty_requires_clearance_for_the_whole_interval() -> None:
    result = sightline(
        1000,
        ElevationRange(10, 30),
        height(20),
        (RayObstacle("uncertain", "building", 500, ElevationRange(15, 25)),),
        complete_coverage=True,
    )
    assert result.status == "unknown"
    assert not any(blocker.confirmed for blocker in result.blockers)


def test_unknown_target_top_does_not_allow_a_blocked_base_to_exclude_a_visible_tower() -> None:
    result = sightline(
        1000,
        height(10),
        ElevationRange(0, None),
        (RayObstacle("building", "building", 500, height(30)),),
        complete_coverage=True,
    )
    assert result.status == "unknown"


def test_earth_curvature_blocks_long_ground_level_sightline() -> None:
    obstacles = tuple(
        RayObstacle(str(i), "terrain", float(i * 1000), height(0)) for i in range(1, 80)
    )
    curved = sightline(80000, height(2), height(2), obstacles, complete_coverage=True)
    flat = sightline(
        80000, height(2), height(2), obstacles, complete_coverage=True, curvature_coefficient=0
    )
    assert curved.status == "blocked"
    assert flat.status == "visible"


@pytest.mark.parametrize("distance", [0, -1, float("nan"), float("inf")])
def test_invalid_path_is_rejected(distance: float) -> None:
    with pytest.raises(ValueError):
        sightline(distance, height(2), height(2), (), complete_coverage=True)


def test_elevated_building_part_can_be_seen_under_but_blocks_its_vertical_volume() -> None:
    deck = RayObstacle("bridge-deck", "building", 500, height(30), height(20))
    under = sightline(1000, height(10), height(10), (deck,), complete_coverage=True)
    through = sightline(1000, height(25), height(25), (deck,), complete_coverage=True)
    above = sightline(1000, height(40), height(40), (deck,), complete_coverage=True)
    assert under.status == "visible"
    assert through.status == "blocked"
    assert above.status == "visible"
