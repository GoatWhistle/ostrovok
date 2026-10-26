from typing import Any

import httpx
import pytest

from hotel_agent.adapters.external.gbif import GBIFObservations
from hotel_agent.application.ports.place_research import PlaceResearchRequest


def observation(**changes: Any) -> dict[str, Any]:
    return {
        "key": 123,
        "scientificName": "Pica pica",
        "basisOfRecord": "HUMAN_OBSERVATION",
        "occurrenceStatus": "PRESENT",
        "license": "http://creativecommons.org/licenses/by/4.0/",
        "decimalLongitude": 39.721,
        "decimalLatitude": 43.581,
        "coordinateUncertaintyInMeters": 100,
        "eventDate": "2024-05-14T12:00:00Z",
        **changes,
    }


@pytest.mark.parametrize(
    "changes,count",
    [
        ({}, 1),
        ({"basisOfRecord": "PRESERVED_SPECIMEN"}, 0),
        ({"license": "http://creativecommons.org/licenses/by-nc/4.0/"}, 0),
        ({"coordinateUncertaintyInMeters": None}, 0),
        ({"coordinateUncertaintyInMeters": 5000}, 0),
        ({"decimalLongitude": 40.1}, 0),
        ({"eventDate": "2099-01-01"}, 0),
        ({"occurrenceStatus": "ABSENT"}, 0),
        ({"decimalLatitude": float("nan")}, 0),
    ],
)
async def test_licensed_historical_observations_respect_radius_and_accuracy(
    changes: dict[str, Any], count: int
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("match"):
            return httpx.Response(
                200,
                json={
                    "matchType": "EXACT",
                    "confidence": 98,
                    "usageKey": 1,
                    "acceptedUsageKey": 2,
                    "scientificName": "Pica pica",
                },
            )
        assert request.url.params["taxonKey"] == "2"
        data = observation(**changes)
        if changes.get("decimalLatitude") != changes.get("decimalLatitude"):
            return httpx.Response(200, text='{"results": [{"decimalLatitude": NaN}]}')
        return httpx.Response(200, json={"results": [data]})

    provider = GBIFObservations(httpx.MockTransport(respond))
    try:
        result = await provider.research(PlaceResearchRequest((39.72, 43.58), 1000, "Pica pica"))
        assert len(result.records) == count
        assert bool(result.values) == bool(count)
        if count:
            assert result.values["observation_count"] == 1
            assert result.sources == ("https://www.gbif.org/occurrence/123",)
    finally:
        await provider.aclose()


async def test_fuzzy_name_is_not_accepted_even_with_high_confidence() -> None:
    provider = GBIFObservations(
        httpx.MockTransport(
            lambda r: httpx.Response(
                200, json={"matchType": "FUZZY", "confidence": 99, "usageKey": 1}
            )
        )
    )
    try:
        with pytest.raises(ValueError, match="ambiguous"):
            await provider.research(PlaceResearchRequest((39.72, 43.58), 1000, "Pica picca"))
    finally:
        await provider.aclose()
