from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

from hotel_agent.adapters.external.hotel_web_card import WebHotelCard, query
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from hotel_agent.domain.hotel_identity import HotelIdentity

HOTEL = HotelIdentity(
    name="Союз",
    address="Шереметевский проспект 47",
    location=(40.986897, 57.0033662),
    city="Иваново",
)
CARD = {
    "@type": "Hotel",
    "name": "Отель Союз",
    "address": {"streetAddress": "Шереметевский проспект, 47Б", "addressLocality": "Иваново"},
    "geo": {"latitude": "57.00360", "longitude": "40.98720"},
    "telephone": "+7 4932 00-00-00",
    "starRating": {"ratingValue": "3"},
    "numberOfRooms": "60",
    "checkinTime": "14:00",
    "amenityFeature": [
        {"@type": "LocationFeatureSpecification", "name": "Парковка", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "Бассейн", "value": False},
    ],
    "aggregateRating": {"ratingValue": "9.1", "reviewCount": "413"},
    "image": ["https://hotelsouz.ru/photo.jpg"],
}
OTHER_CITY = {
    "@type": "Hotel",
    "name": "Отель Союз",
    "address": {"streetAddress": "улица Лесная, 25", "addressLocality": "Дзержинский"},
    "geo": {"latitude": "55.63", "longitude": "37.85"},
}


def research(pages: dict[str, WebPage], hits: tuple[str, ...]) -> WebResearchPort:
    return cast(
        WebResearchPort,
        SimpleNamespace(
            search=AsyncMock(
                return_value=[
                    WebPage(url=url, title="", text="", retrieved_at=datetime.now(UTC))
                    for url in hits
                ]
            ),
            read=AsyncMock(side_effect=lambda url: pages[url]),
        ),
    )


def page(url: str, *records: dict[str, Any]) -> WebPage:
    return WebPage(
        url=url, title="Союз", text="", retrieved_at=datetime.now(UTC), hotels=tuple(records)
    )


def test_the_query_keeps_the_hotel_name_as_a_phrase() -> None:
    assert query(HOTEL).startswith('"Союз" Иваново Шереметевский проспект 47')


async def test_a_matching_page_becomes_a_card_with_its_source() -> None:
    url = "https://hotelsouz.ru/"
    found = await WebHotelCard(research({url: page(url, CARD)}, (url,))).find(HOTEL)

    assert found is not None
    assert found.details.supplier_id == "hotelsouz.ru"
    assert found.details.page_url == url
    assert found.details.city == "Иваново"
    assert found.details.facts.rooms_number == 60
    assert found.details.facts.star_rating == 3
    assert found.details.check_in_from == "14:00"
    assert found.details.rating is not None
    assert found.details.rating.reviews_count == 413
    assert [group.name for group in found.details.amenity_groups] == ["Удобства"]
    assert [item.name for item in found.details.amenity_groups[0].amenities] == ["Парковка"]
    assert [photo.url for photo in found.details.photos] == ["https://hotelsouz.ru/photo.jpg"]


async def test_a_same_name_hotel_in_another_city_is_not_accepted() -> None:
    url = "https://example.org/soyuz"
    assert await WebHotelCard(research({url: page(url, OTHER_CITY)}, (url,))).find(HOTEL) is None


async def test_pages_without_hotel_markup_are_skipped_until_one_matches() -> None:
    first, second = "https://example.org/blog", "https://hotelsouz.ru/"
    pages = {first: page(first), second: page(second, CARD)}
    found = await WebHotelCard(research(pages, (first, second))).find(HOTEL)
    assert found is not None
    assert found.details.page_url == second


async def test_an_unavailable_search_does_not_fail_the_card_lookup() -> None:
    port = cast(
        WebResearchPort,
        SimpleNamespace(search=AsyncMock(side_effect=ValueError("unavailable")), read=AsyncMock()),
    )
    assert await WebHotelCard(port).find(HOTEL) is None


async def test_an_unreadable_page_is_skipped() -> None:
    url = "https://example.org/blocked"
    port = cast(
        WebResearchPort,
        SimpleNamespace(
            search=AsyncMock(
                return_value=[WebPage(url=url, title="", text="", retrieved_at=datetime.now(UTC))]
            ),
            read=AsyncMock(side_effect=ValueError("blocked")),
        ),
    )
    assert await WebHotelCard(port).find(HOTEL) is None
