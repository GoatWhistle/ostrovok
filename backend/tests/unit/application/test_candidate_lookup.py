from dataclasses import replace

from hotel_agent.application.agent.candidate_lookup import lookup_candidates
from tests.unit.application.test_research_tools import HOTEL


def test_lookup_uses_catalogue_aliases_without_verifying_a_wish() -> None:
    hotels = [replace(HOTEL, id="renamed", name="New Harbor"), HOTEL]
    rows = [
        {"hotel_id": "renamed", "tags": {"old_name": "Старый маяк", "addr:street": "Морская"}},
        {"hotel_id": "h1", "tags": {}},
    ]
    result = lookup_candidates(hotels, rows, {"query": "Старый маяк"})
    assert [h["hotel_id"] for h in result["candidates"]] == ["renamed"]
    assert result["discovery_only"] is True
    assert result["candidates"][0]["identity_tags"]["old_name"] == "Старый маяк"


def test_lookup_does_not_confuse_shared_city_with_identity() -> None:
    hotels = [replace(HOTEL, id="a", name="Aurora"), replace(HOTEL, id="b", name="Aurora")]
    result = lookup_candidates(hotels, [], {"query": "Aurora", "limit": 1})
    assert result["total"] == 2
    assert result["next_offset"] == 1
    assert lookup_candidates(hotels, [], {"query": "Unknown"})["candidates"] == []
