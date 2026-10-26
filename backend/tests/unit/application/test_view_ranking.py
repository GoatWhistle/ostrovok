from datetime import UTC, datetime

from hotel_agent.adapters.geo.window_reports import window_evidence
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.search_ranking import search_rank
from hotel_agent.application.spatial_matching import spatial_intent
from hotel_agent.domain.query import SpatialRequest
from hotel_agent.domain.services.scoring import score


def test_zero_score_keeps_geometrically_checked_hotel_ahead_of_unchecked_alphabetical_name() -> (
    None
):
    request = SpatialRequest(
        kind="landmark_view", target="Башня", radius_m=2000, source_text="вид на башню"
    )
    now = datetime(2026, 10, 26, tzinfo=UTC)
    record, _ = window_evidence("checked", request, now, None, "Нет высоты препятствия")
    record.qualifiers["visibility"]["target_location"] = [39, 43]
    fact = fact_from_record(record)
    checked = SearchHotelRecord(
        id="checked",
        region_id="sochi",
        name="Яркий отель",
        location=(39, 43),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    unchecked = SearchHotelRecord(
        id="unchecked",
        region_id="sochi",
        name="А отель",
        location=(39, 43),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    intents = (spatial_intent(request),)
    checked_score = score(intents, {record.characteristic_key: fact}, now)
    unchecked_score = score(intents, {}, now)
    assert checked_score.score == unchecked_score.score == 0
    assert search_rank(checked, checked_score) < search_rank(unchecked, unchecked_score)
