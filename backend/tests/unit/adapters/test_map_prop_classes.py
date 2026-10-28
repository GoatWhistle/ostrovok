from pathlib import Path

from hotel_agent.adapters.map_catalog.importer import poi_class
from hotel_agent.adapters.map_catalog.loader import load_catalog

CATALOG = load_catalog(Path(__file__).resolve().parents[4] / "map-catalog")


def test_prop_tags_take_their_own_class_before_the_poi_fallback() -> None:
    assert poi_class(CATALOG, {"amenity": "fountain"}) == ("fountain", "prop")
    assert poi_class(CATALOG, {"amenity": "bench"}) == ("bench", "prop")
    assert poi_class(CATALOG, {"highway": "street_lamp"}) == ("lamp", "prop")


def test_viewpoint_keeps_the_attraction_class() -> None:
    assert poi_class(CATALOG, {"tourism": "viewpoint"}) == ("poi_attraction", "tag")


def test_unclassified_place_falls_back_to_the_default_poi() -> None:
    assert poi_class(CATALOG, {"natural": "waterfall"}) == ("default_poi", "tag")
    assert poi_class(CATALOG, {}) == ("default_poi", "tag")


def test_tree_row_lines_are_a_prop_class_with_a_colour_token() -> None:
    found = CATALOG.classify({"natural": "tree_row"}, "prop")
    assert found.key == "tree_row"
    assert found.match
    assert found.style["fill"] == "--map-class-tree_row"


def test_a_cliff_line_matches_no_prop_class_and_is_not_imported() -> None:
    assert not CATALOG.classify({"natural": "cliff"}, "prop").match
