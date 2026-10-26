from dataclasses import replace
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


def test_named_chain_is_a_separate_condition_from_its_category() -> None:
    shop = NearbyObjectRequest(
        osm_key="shop",
        osm_value="supermarket",
        open_24h=False,
        radius_m=500,
        source_text="рядом с Вкусвилл",
    )
    named = replace(shop, name="Вкусвилл")
    now = datetime(2026, 10, 27, tzinfo=UTC)

    assert nearby_key(named) != nearby_key(shop)
    empty = nearby_record("h1", nearby_key(named), named, (), now, {})
    assert empty.value == 0
    found = nearby_record("h1", nearby_key(named), named, ("p1",), now, {"p1": "ВкусВилл"})
    assert found.qualifiers["nearby_names"] == ["ВкусВилл"]
    assert "«ВкусВилл»" in found.explanation and "Вкусвилл" in found.explanation
