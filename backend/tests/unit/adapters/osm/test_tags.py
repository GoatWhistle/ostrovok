import pytest

from hotel_agent.adapters.osm import tags


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ({"tourism": "hotel"}, True),
        ({"tourism": "hostel"}, True),
        ({"tourism": "guest_house"}, True),
        ({"tourism": "museum"}, False),
        ({"amenity": "hotel"}, False),
        ({}, False),
    ],
)
def test_only_lodging_counts_as_a_hotel(given: dict[str, str], expected: bool) -> None:
    assert tags.is_hotel(given) is expected


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ({"building": "yes"}, True),
        ({"building": "hotel"}, True),
        ({"building": "no"}, False),
        ({"building:levels": "9"}, False),
    ],
)
def test_building_no_is_not_a_building(given: dict[str, str], expected: bool) -> None:
    assert tags.is_building(given) is expected


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ({"highway": "footway"}, True),
        ({"highway": "residential"}, True),
        ({"highway": "motorway"}, False),
        ({"highway": "footway", "foot": "no"}, False),
        ({"highway": "footway", "access": "private"}, False),
        ({"highway": "footway", "access": "customers"}, True),
        ({"railway": "rail"}, False),
    ],
)
def test_walkability_respects_foot_and_access(given: dict[str, str], expected: bool) -> None:
    assert tags.is_walkable(given) is expected


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ({"highway": "primary"}, True),
        ({"highway": "trunk"}, True),
        ({"railway": "rail"}, True),
        ({"highway": "footway"}, False),
    ],
)
def test_noise_sources_are_major_roads_and_rails(given: dict[str, str], expected: bool) -> None:
    assert tags.is_noise_source(given) is expected


def test_only_declared_keys_survive_the_cut() -> None:
    kept = tags.selected(
        {"name": "Приморская", "tourism": "hotel", "fixme": "check", "wikidata": "Q1"},
        tags.HOTEL_KEYS,
    )

    assert kept == {"name": "Приморская", "tourism": "hotel"}


def test_a_motorway_is_loud_but_never_walkable() -> None:
    motorway = {"highway": "motorway"}

    assert tags.is_noise_source(motorway) and not tags.is_walkable(motorway)
