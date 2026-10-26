from dataclasses import replace

from hotel_agent.application.exploration_requests import exploration_terms
from hotel_agent.domain.query import FacilityRequest, ParsedQuery, SpatialRequest


def query() -> ParsedQuery:
    term = "с видом на Эрмитаж, без здания перед окнами"
    return ParsedQuery(
        intents=(),
        unmatched_terms=(),
        location_hint="Санкт-Петербург",
        spatial_requests=(
            SpatialRequest(kind="landmark_view", target="Эрмитаж", radius_m=2000, source_text=term),
        ),
        wishes=("с видом на Эрмитаж", "без здания перед окнами", "с завтраком"),
    )


def test_view_fragments_do_not_start_duplicate_research() -> None:
    parsed = query()
    assert exploration_terms(parsed) == (
        "с видом на Эрмитаж, без здания перед окнами",
        "с завтраком",
    )


def test_independent_structured_condition_inside_longer_quote_is_preserved() -> None:
    parsed = replace(
        query(),
        spatial_requests=(
            replace(query().spatial_requests[0], source_text="с видом на Эрмитаж и с завтраком"),
        ),
        facility_requests=(FacilityRequest(term="завтрак", source_text="с завтраком"),),
    )
    assert "с завтраком" in exploration_terms(parsed)


def test_unmatched_condition_is_not_silently_claimed_by_another_tool() -> None:
    parsed = replace(query(), unmatched_terms=("без здания перед окнами",))
    assert "без здания перед окнами" in exploration_terms(parsed)


def test_substring_inside_a_word_does_not_remove_an_independent_wish() -> None:
    parsed = replace(
        query(),
        spatial_requests=(
            SpatialRequest(
                kind="landmark_view",
                target="Дворец",
                radius_m=2000,
                source_text="с видом на барочный дворец",
            ),
        ),
        wishes=("бар",),
    )
    assert "бар" in exploration_terms(parsed)
