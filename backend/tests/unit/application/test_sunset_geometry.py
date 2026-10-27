from datetime import date

from hotel_agent.application.agent.sunset_geometry import (
    arc_middle,
    faces_arc,
    minimum_floor,
    separation,
    sunset_arc,
    sunset_azimuth,
)

SOCHI = (39.73, 43.59)


def test_the_sun_sets_south_of_west_in_winter_and_north_of_west_in_summer() -> None:
    december = sunset_azimuth(date(2026, 12, 15), *SOCHI)
    june = sunset_azimuth(date(2026, 6, 15), *SOCHI)

    assert december is not None and june is not None
    assert 230 < december < 245
    assert 298 < june < 308


def test_the_summer_season_arc_spans_west_to_north_west() -> None:
    arc = sunset_arc(*SOCHI, 2026)

    assert arc is not None
    assert 280 < arc[0] < 290
    assert 298 < arc[1] < 308
    assert 290 < arc_middle(arc) < 298


def test_the_polar_day_has_no_sunset() -> None:
    assert sunset_azimuth(date(2026, 6, 15), 18.95, 69.65) is None


def test_only_a_facade_turned_to_the_arc_sees_the_sunset() -> None:
    arc = (283.0, 303.0)

    assert faces_arc(270.0, arc)
    assert faces_arc(300.0, arc)
    assert not faces_arc(90.0, arc)
    assert not faces_arc(180.0, arc)


def test_separation_is_measured_the_short_way_round() -> None:
    assert separation(350.0, 10.0) == 20.0
    assert separation(10.0, 350.0) == 20.0


def test_the_floor_clears_the_tallest_obstacle_on_the_ray() -> None:
    assert minimum_floor(10.0, 9.0) == 1
    assert minimum_floor(10.0, 10.0) == 1
    assert minimum_floor(10.0, 13.0) == 2
    assert minimum_floor(10.0, 24.0) == 6
