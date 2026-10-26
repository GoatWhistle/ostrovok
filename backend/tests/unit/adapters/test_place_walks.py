from hotel_agent.adapters.geo.place_walks import calculate_walks
from hotel_agent.application.dto import Feature
from hotel_agent.application.walk_refs import parse_walk_ref

ORIGIN = (39.9, 43.4)
CORNER = (39.901, 43.4)
TARGET = (39.901, 43.401)


def line(id: str, points: list[tuple[float, float]]) -> Feature:
    return Feature(id=id, geometry={"type": "LineString", "coordinates": points}, properties={})


def test_route_follows_connected_edges_with_the_same_speed_as_sea_routes() -> None:
    paths = calculate_walks(
        "n1", ORIGIN, {"w2": TARGET}, [line("w1", [ORIGIN, CORNER, TARGET])], 500
    )
    assert len(paths) == 1
    route = paths[0]
    assert route.mode == "graph"
    assert route.minutes == round(route.meters / 80, 1)
    coordinates = route.geometry["coordinates"]
    assert isinstance(coordinates, list)
    assert CORNER in coordinates
    assert route.meters > 180


def test_disconnected_and_unsnapped_targets_are_honest_straight_lines() -> None:
    isolated = (39.9, 43.405)
    edges = [line("a", [ORIGIN, CORNER]), line("b", [isolated, (39.901, 43.405)])]
    routes = calculate_walks("n1", ORIGIN, {"n2": isolated, "n3": (39.9, 43.42)}, edges, 500)
    assert all(route.mode == "straight" and route.minutes is None for route in routes)
    for route in routes:
        coordinates = route.geometry["coordinates"]
        assert isinstance(coordinates, list) and len(coordinates) == 2


def test_no_walk_edges_still_returns_distance_without_inventing_minutes() -> None:
    route = calculate_walks("n1", ORIGIN, {"w2": TARGET}, [], 500)[0]
    assert route.mode == "straight"
    assert route.minutes is None
    assert route.meters > 0


def test_virtual_walk_ids_require_two_unambiguous_osm_identifiers() -> None:
    assert parse_walk_ref("g_walk_n123_w456") == ("n123", "w456")
    assert parse_walk_ref("g_walk_r123_n456") == ("r123", "n456")
    for value in ("g_walk_n123_w456_extra", "g_walk_a_b", "g_walk_n1_n2/", "g_poi_n1"):
        assert parse_walk_ref(value) is None
