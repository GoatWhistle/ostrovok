from datetime import UTC, datetime

from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.nearby_matching import nearby_intent, nearby_key, nearby_record
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import NearbyObjectRequest
from hotel_agent.domain.services.scoring import MatchQuality, match


def test_minimum_distance_counts_zero_objects_inside_radius() -> None:
    request = NearbyObjectRequest(
        osm_key="aeroway",
        osm_value="aerodrome",
        open_24h=False,
        radius_m=10000,
        source_text="аэропорт минимум в 10 км",
        avoid=True,
        required=True,
    )
    now = datetime(2026, 10, 25, tzinfo=UTC)

    absent = nearby_record("h1", nearby_key(request), request, (), now)
    present = nearby_record("h2", nearby_key(request), request, ("w1",), now)

    assert nearby_intent(request).op is Op.LTE
    assert nearby_intent(request).required
    assert (
        match(nearby_intent(request), fact_from_record(absent), now).quality is MatchQuality.PARTIAL
    )
    assert (
        match(nearby_intent(request), fact_from_record(present), now).quality is MatchQuality.NONE
    )
    assert "отсутствие не гарантировано" in absent.explanation
