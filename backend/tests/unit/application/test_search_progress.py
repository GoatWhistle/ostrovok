from dataclasses import replace

from hotel_agent.application import progress
from hotel_agent.application.chat_dialogue import needs_city
from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.search_candidates import Candidates
from hotel_agent.application.search_progress import report_candidates, understood
from hotel_agent.domain.query import NearbyObjectRequest, ParsedQuery, SpatialRequest


def test_candidates_report_real_positions_without_scores() -> None:
    hotel = SearchHotelRecord(
        id="h",
        region_id="r",
        name="Hotel",
        location=(49.1, 55.7),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    events: list[dict[str, object]] = []
    token = progress.listen(lambda _stage, fields: events.append(fields))
    try:
        report_candidates(Candidates([hotel], "r", None), "City")
    finally:
        progress.release(token)
    assert events[0]["hotels"] == [
        {"id": "h", "name": "Hotel", "location": (49.1, 55.7), "rating": None}
    ]
    assert events[0]["bbox"] == (49.1, 55.7, 49.1, 55.7)
    assert "score" not in events[0]


def test_city_question_uses_saved_search_state_instead_of_answer_wording() -> None:
    previous = ConversationRecord(
        id="c",
        region_id="r",
        effective_query="quiet",
        messages=(),
        search_snapshot={"parsed": {"needs_clarification": True, "location_hint": None}},
    )
    assert needs_city(previous)
    assert not needs_city(None)


def test_only_proximity_requests_enable_map_tour() -> None:
    base = ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи")
    assert understood(base, "Сочи")["route_search"] is False
    nearby = NearbyObjectRequest(
        osm_key="amenity",
        osm_value="bar",
        open_24h=False,
        radius_m=500,
        source_text="рядом с баром",
    )
    assert understood(replace(base, nearby_objects=(nearby,)), "Сочи")["route_search"] is True
    view = SpatialRequest(kind="landmark_view", target="море", radius_m=500, source_text="вид")
    assert understood(replace(base, spatial_requests=(view,)), "Сочи")["route_search"] is False
