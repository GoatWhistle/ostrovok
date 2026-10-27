import json

import httpx
import pytest

from hotel_agent.adapters.external.commons_photos import CommonsPhotos
from hotel_agent.application.ports.place_research import PlaceResearchRequest

SOCHI = (39.7300, 43.5900)


def page(
    title: str, lon: float, lat: float, licence: str, taken: str = "2021-07-04"
) -> dict[str, object]:
    return {
        "title": title,
        "coordinates": [{"lon": lon, "lat": lat}],
        "imageinfo": [
            {
                "descriptionurl": f"https://commons.wikimedia.org/wiki/{title}",
                "extmetadata": {
                    "LicenseShortName": {"value": licence},
                    "DateTimeOriginal": {"value": taken},
                },
            }
        ],
    }


def provider(pages: list[dict[str, object]]) -> CommonsPhotos:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=json.dumps({"query": {"pages": pages}}))

    return CommonsPhotos("test-agent", httpx.MockTransport(handle))


async def test_free_photos_near_the_point_are_returned_nearest_first() -> None:
    photos = provider(
        [
            page("File:Far.jpg", 39.7340, 43.5900, "CC BY-SA 4.0"),
            page("File:Near.jpg", 39.7305, 43.5900, "CC0"),
        ]
    )

    result = await photos.research(PlaceResearchRequest(SOCHI, 1000))

    assert [row["title"] for row in result.records] == ["File:Near.jpg", "File:Far.jpg"]
    assert result.values["photo_count"] == 2
    assert result.records[0]["date"] == "2021-07-04"
    await photos.aclose()


async def test_a_photo_without_a_free_licence_is_dropped() -> None:
    photos = provider([page("File:Rights.jpg", 39.7305, 43.5900, "All rights reserved")])

    result = await photos.research(PlaceResearchRequest(SOCHI, 1000))

    assert result.records == ()
    assert result.values == {}
    await photos.aclose()


async def test_a_photo_beyond_the_radius_is_dropped() -> None:
    photos = provider([page("File:Away.jpg", 39.8000, 43.5900, "CC0")])

    result = await photos.research(PlaceResearchRequest(SOCHI, 300))

    assert result.records == ()
    await photos.aclose()


async def test_an_oversized_radius_is_refused() -> None:
    photos = provider([])

    with pytest.raises(ValueError, match="10000"):
        await photos.research(PlaceResearchRequest(SOCHI, 50000))
    await photos.aclose()


async def test_a_note_warns_that_a_nearby_photo_is_not_a_window_view() -> None:
    photos = provider([page("File:Near.jpg", 39.7305, 43.5900, "CC0")])

    result = await photos.research(PlaceResearchRequest(SOCHI, 1000))

    assert "not what is visible from a room" in result.note
    await photos.aclose()


async def test_an_upstream_error_is_reported_instead_of_an_empty_result() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=json.dumps({"error": {"code": "cirrussearch-too-busy-error"}})
        )

    photos = CommonsPhotos("test-agent", httpx.MockTransport(handle))

    with pytest.raises(ValueError, match="cirrussearch-too-busy-error"):
        await photos.research(PlaceResearchRequest(SOCHI, 1000))
    await photos.aclose()
