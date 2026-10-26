import pytest

from hotel_agent.adapters.geo.building_dimensions import building_dimensions, length_values
from hotel_agent.adapters.geo.facade_observers import facade_observers


@pytest.mark.parametrize(("raw", "expected"), [("30 m", 30), ("100ft", 30.48), ("12,5", 12.5)])
def test_building_height_units_are_preserved(raw: str, expected: float) -> None:
    assert length_values(raw) == pytest.approx((expected,))


def test_storeys_produce_explicit_height_interval_instead_of_a_false_exact_height() -> None:
    result = building_dimensions({"building:levels": "5"})
    assert result.height is not None
    assert result.height.minimum_m == 13.5
    assert result.height.maximum_m == 25.5
    assert result.height_source == "osm:building:levels"
    assert result.estimated
    assert result.levels == 5


def test_invalid_or_missing_height_does_not_become_zero_height() -> None:
    assert building_dimensions({"height": "unknown"}).height is None
    assert building_dimensions({}).height is None


def test_explicit_height_precedes_storey_estimate_and_retains_minimum_height() -> None:
    result = building_dimensions({"height": "40", "min_height": "10", "building:levels": "8"})
    assert result.height is not None and result.height.minimum_m == result.height.maximum_m == 40
    assert result.minimum_height_m == 10
    assert not result.estimated


def footprint() -> dict[str, object]:
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [39.7198, 43.5799],
                [39.7202, 43.5799],
                [39.7202, 43.5801],
                [39.7198, 43.5801],
                [39.7198, 43.5799],
            ]
        ],
    }


def test_observers_are_on_target_facing_facade_not_hotel_centroid() -> None:
    result = facade_observers(footprint(), (39.72, 43.58), (39.73, 43.58))
    assert result
    assert all(row.location[0] > 39.7202 for row in result)
    assert all(abs(row.azimuth_deg - 90) < 1 for row in result)


def test_opposite_windows_cannot_be_reported_as_a_view_of_the_target() -> None:
    assert facade_observers(footprint(), (39.72, 43.58), (39.73, 43.58), 270) == ()


def test_target_inside_own_building_is_not_mistaken_for_an_external_window_view() -> None:
    assert facade_observers(footprint(), (39.72, 43.58), (39.72, 43.58)) == ()


def test_nearly_north_facing_facade_never_rounds_to_invalid_360_degrees() -> None:
    footprint = {
        "type": "Polygon",
        "coordinates": [
            [
                [39 - 0.0001, 43 - 0.0001],
                [39 + 0.0001, 43 - 0.0001],
                [39 + 0.0001, 43 + 0.0001],
                [39 - 0.0001, 43 + 0.000099999],
                [39 - 0.0001, 43 - 0.0001],
            ]
        ],
    }
    observers = facade_observers(footprint, (39, 43), (39, 43.01))
    assert observers
    assert all(0 <= observer.azimuth_deg < 360 for observer in observers)
