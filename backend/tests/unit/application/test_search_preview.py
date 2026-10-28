from dataclasses import replace

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.walk import PlaceWalk
from hotel_agent.application.search_preview import SearchPreview
from hotel_agent.domain.services.scoring import Scored

HOTEL = SearchHotelRecord(
    id="a",
    region_id="r",
    name="A",
    location=(39.7, 43.5),
    stars=None,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)
SCORE = Scored(score=1, matches=(), disqualified=False)


def route(id: str, meters: float, straight: bool = False) -> PlaceWalk:
    return PlaceWalk(
        hotel_id=id,
        place_id="bar",
        meters=meters,
        minutes=None if straight else meters / 80,
        mode="straight" if straight else "graph",
        geometry={"type": "LineString"},
    )


def test_shortest_walk_wins_instead_of_most_nearby_objects() -> None:
    preview = SearchPreview()
    preview.paths = {"a": route("a", 700), "b": route("b", 140)}
    candidates = [(HOTEL, SCORE), (replace(HOTEL, id="b"), SCORE)]
    assert preview.finish(candidates)[0][0].id == "b"


def test_rating_breaks_ties_without_overriding_wishes() -> None:
    preview = SearchPreview()
    high = replace(HOTEL, id="high", rating=9.7)
    matching = replace(HOTEL, id="matching", rating=8.2)
    candidates = [(HOTEL, SCORE), (high, replace(SCORE, score=0.5)), (matching, SCORE)]
    assert preview.finish(candidates)[0][0].id == "matching"


def test_straight_line_is_not_claimed_as_a_shorter_walk() -> None:
    preview = SearchPreview()
    preview.paths = {"a": route("a", 700), "b": route("b", 90, straight=True)}
    assert preview.finish([(HOTEL, SCORE), (replace(HOTEL, id="b"), SCORE)])[0][0].id == "a"
    assert preview.scene(replace(HOTEL, id="b"))["mode"] == "straight"


def test_empty_results_do_not_emit_a_winner() -> None:
    assert SearchPreview().finish([]) == []
