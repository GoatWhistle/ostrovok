import asyncio
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
import pytest

from hotel_agent.adapters.external.ostrovok_lookup import search_queries
from hotel_agent.adapters.external.ostrovok_offers import OstrovokHotelOffers
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure
from hotel_agent.domain.hotel_identity import HotelIdentity

HOTEL = HotelIdentity(
    name="Жемчужина", address="Черноморская улица 3", location=(39.732, 43.571), city="Сочи"
)
CHECK_IN, CHECK_OUT = date(2026, 11, 2), date(2026, 11, 4)
MASTER_ID = 7374217
OTA_ID = "zhemchuzhina_hotel_complex"
PAGE_URL = f"https://ostrovok.ru/hotel/russia/sochi/mid{MASTER_ID}/{OTA_ID}/"


@dataclass
class Clock:
    value: datetime = datetime(2026, 10, 26, tzinfo=UTC)

    def now(self) -> datetime:
        return self.value


def suggestion(**changes: Any) -> dict[str, Any]:
    return {
        "master_id": MASTER_ID,
        "otahotel_id": OTA_ID,
        "hotel_name": "Гостиничный Комплекс Жемчужина",
        "hotel_address": "улица Черноморская, д.3",
        "region_id": 5580,
        "region_name": "Сочи",
        "country_code": "RU",
        "slug": "russia/sochi",
        **changes,
    }


def hotel_page(**changes: Any) -> dict[str, Any]:
    page = {
        "id": OTA_ID,
        "masterId": str(MASTER_ID),
        "name": "Гостиничный Комплекс Жемчужина",
        "location": {
            "address": "улица Черноморская, д.3, Сочи",
            "city": "Сочи",
            "latitude": 43.571,
            "longitude": 39.732,
            "pois": [{"name": "Пляж Жемчужина", "distance": 168, "poiSubtypeSlug": "BEACH"}],
        },
        "serpFilters": ["HAS_POOL", "HAS_INTERNET"],
        "images": [{"tmpl": "https://cdn.ostrovok.ru/t/{size}/hotel.jpg", "category": "Outside"}],
        "facts": {
            "floorsNumber": 19,
            "roomsNumber": 881,
            "starRating": 4,
            "yearBuilt": 1973,
            "register": {
                "record": "С232024007508",
                "link": "https://tourism.fsa.gov.ru/ru/resorts/hotels/abc/about-resort",
                "rooms": [{"roomsCount": 736, "categoryType": "CT_FIRST_STANDARD"}],
            },
        },
        "amenityGroups": [
            {"name": "Общее", "amenities": [{"name": "Лифт", "isFree": 1}]},
        ],
        "descriptionStruct": [{"title": "Расположение", "paragraphs": ["Отель в Сочи."]}],
        "rating": {"total": 7.9, "reviewsCount": 302, "ostrovok": {"detailedRatings": {}}},
        "policies": {
            "checkInCheckOut": {
                "value": {
                    "checkInTimeStart": {"hours": 15, "minutes": 0},
                    "checkOutTimeEnd": {"hours": 12, "minutes": 0},
                }
            }
        },
        "contacts": {"email": "stay@example.test", "phone": "+78622661188"},
        "roomGroups": [
            {
                "rgHash": "3102302",
                "nameStruct": {"mainName": "Стандарт", "beddingType": "двуспальная кровать"},
                "size": 17,
                "roomAmenityData": ["shower"],
                "images": [{"tmpl": "https://cdn.ostrovok.ru/t/{size}/room.jpg"}],
            }
        ],
    }
    page.update(changes)
    return page


def rate(**changes: Any) -> dict[str, Any]:
    return {
        "hash": "rate-1",
        "hotel_id": OTA_ID,
        "room_name": "Двухместный номер с балконом",
        "payment_options": {
            "payment_types": [{"show_amount": "12000.00", "show_currency_code": "RUB"}]
        },
        "meal_data": {"meals": [{"value": "breakfast", "has_breakfast": True}]},
        "rooms": [{"amenities_data": ["non-smoking"]}],
        **changes,
    }


def rates_body(rates: list[dict[str, Any]] | None) -> dict[str, Any]:
    return {"ota_hotel_id": OTA_ID, "master_id": MASTER_ID, "rates": rates}


DEFAULT_RATES: list[dict[str, Any]] = []


def responder(
    suggestions: list[dict[str, Any]] | None = None,
    pages: dict[int, dict[str, Any]] | None = None,
    rates: list[dict[str, Any]] | None = DEFAULT_RATES,
    requests: list[httpx.Request] | None = None,
) -> Callable[[httpx.Request], httpx.Response]:
    found = [suggestion()] if suggestions is None else suggestions
    body = rates_body([rate()] if rates is DEFAULT_RATES else rates)

    def respond(request: httpx.Request) -> httpx.Response:
        if requests is not None:
            requests.append(request)
        assert "authorization" not in request.headers
        path = request.url.path
        if path == "/api/site/multicomplete.json":
            return httpx.Response(200, json={"hotels": found})
        if path == "/hotel/search/v1/site/hp/search":
            return httpx.Response(200, json=body)
        for master_id, page in (pages or {MASTER_ID: hotel_page()}).items():
            if f"mid{master_id}/" in path:
                script = json.dumps({"props": {"pageProps": {"hotel": page}}})
                return httpx.Response(
                    200, text=f'<html><script id="__NEXT_DATA__">{script}</script></html>'
                )
        return httpx.Response(404)

    return respond


def site(
    suggestions: list[dict[str, Any]] | None = None,
    pages: dict[int, dict[str, Any]] | None = None,
    rates: list[dict[str, Any]] | None = DEFAULT_RATES,
    requests: list[httpx.Request] | None = None,
) -> httpx.MockTransport:
    return httpx.MockTransport(responder(suggestions, pages, rates, requests))


async def test_catalogue_lookup_returns_rooms_photos_facts_and_caches() -> None:
    requests: list[httpx.Request] = []
    expensive = rate(hash="expensive")
    expensive["payment_options"]["payment_types"][0]["show_amount"] = "15000"
    clock = Clock()
    async with httpx.AsyncClient(transport=site(rates=[rate(), expensive], requests=requests)) as (
        client
    ):
        provider = OstrovokHotelOffers(clock, client)
        result = await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert result is not None
        assert result.facilities == ("has_pool", "has_internet")
        assert result.room_categories == ("Стандарт",)
        assert result.photo_url == "https://cdn.ostrovok.ru/t/1024x768/hotel.jpg"
        assert result.rates_complete
        [room] = result.room_groups
        assert room.name == "Стандарт"
        assert room.bedding == "двуспальная кровать"
        assert room.size_sqm == 17
        assert room.photos == ("https://cdn.ostrovok.ru/t/1024x768/room.jpg",)
        details = result.details
        assert details is not None
        assert details.page_url == PAGE_URL
        assert details.location == (39.732, 43.571)
        assert details.facts.floors_number == 19
        assert details.facts.rooms_number == 881
        assert details.facts.year_built == 1973
        assert details.facts.registry is not None
        assert details.facts.registry.record == "С232024007508"
        assert details.facts.registry.categories[0].rooms == 736
        assert [group.name for group in details.amenity_groups] == ["Общее"]
        assert details.amenity_groups[0].amenities[0].free
        assert details.nearby[0].distance_m == 168
        assert details.description[0].title == "Расположение"
        assert details.rating is not None
        assert details.rating.total == 7.9
        assert details.check_in_from == "15:00"
        assert details.check_out_until == "12:00"
        assert details.email == "stay@example.test"
        assert [offer.price_amount for offer in result.offers] == [12000, 15000]
        first = result.offers[0]
        assert first.price_currency == "RUB"
        assert first.meal == "breakfast"
        assert first.amenities == ("non-smoking",)
        assert first.floor_number is None
        assert result.checked_at == clock.now()
        assert await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") is result
        settled = len(requests)
        clock.value += timedelta(minutes=11)
        await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert len(requests) == settled + 1
        await provider.aclose()
        assert not client.is_closed


async def test_resolved_identity_is_reused_without_repeating_catalogue_calls() -> None:
    requests: list[httpx.Request] = []
    async with httpx.AsyncClient(transport=site(requests=requests)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        assert await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") is not None
        catalogue = [r for r in requests if r.url.path == "/api/site/multicomplete.json"]
        await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 3, "ru")
        assert [r for r in requests if r.url.path == "/api/site/multicomplete.json"] == catalogue
        rates = [r for r in requests if r.url.path == "/hotel/search/v1/site/hp/search"]
        assert len(rates) == 2
        await provider.aclose()


@pytest.mark.parametrize("kind", ["address", "name", "far", "ambiguous", "empty", "foreign"])
async def test_unconfirmed_identity_never_returns_another_hotels_prices(kind: str) -> None:
    suggestions = [suggestion()]
    pages = {MASTER_ID: hotel_page()}
    if kind == "address":
        pages[MASTER_ID]["location"]["address"] = "улица Черноморская, д.33, Сочи"
    elif kind == "name":
        pages[MASTER_ID]["name"] = "Другая гостиница"
        pages[MASTER_ID]["location"]["address"] = "улица Лесная, д.8, Сочи"
    elif kind == "far":
        pages[MASTER_ID]["location"]["latitude"] = 43.671
        pages[MASTER_ID]["location"]["address"] = "улица Лесная, д.8, Сочи"
    elif kind == "ambiguous":
        suggestions.append(suggestion(master_id=42, otahotel_id="zhemchuzhina_twin"))
        pages[42] = hotel_page(
            id="zhemchuzhina_twin", masterId="42", name="Отель Жемчужина Приморская"
        )
    elif kind == "foreign":
        suggestions = [suggestion(country_code="KZ")]
    else:
        suggestions = []

    async with httpx.AsyncClient(transport=site(suggestions, pages)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        assert await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") is None
        await provider.aclose()


@pytest.mark.parametrize("status", [403, 429, 500])
async def test_site_errors_are_provider_failures(status: int) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status))
    ) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        with pytest.raises(OfferProviderFailure):
            await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        await provider.aclose()


async def test_concurrent_requests_share_one_lookup() -> None:
    requests: list[httpx.Request] = []

    reply = responder(requests=requests)

    async def respond(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(0)
        return reply(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        results = await asyncio.gather(
            *(provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") for _ in range(4))
        )
        assert all(result is results[0] for result in results)
        catalogue = [r for r in requests if r.url.path == "/api/site/multicomplete.json"]
        assert len(catalogue) == len(search_queries(HOTEL))
        assert len([r for r in requests if "/hp/search" in r.url.path]) == 1
        await provider.aclose()


@pytest.mark.parametrize(
    "kind", ["price", "currency", "json", "coordinates", "rates", "page_identity", "rate_identity"]
)
async def test_invalid_provider_data_is_not_accepted(kind: str) -> None:
    pages = {MASTER_ID: hotel_page()}
    broken = rate()
    rates: list[dict[str, Any]] | None = [broken]
    if kind == "price":
        broken["payment_options"]["payment_types"][0]["show_amount"] = "NaN"
    elif kind == "currency":
        broken["payment_options"]["payment_types"][0]["show_currency_code"] = "USD"
    elif kind == "coordinates":
        pages[MASTER_ID]["location"]["latitude"] = None
    elif kind == "rates":
        rates = None
    elif kind == "page_identity":
        pages[MASTER_ID]["masterId"] = "999"
    elif kind == "rate_identity":
        broken["hotel_id"] = "another_hotel"

    reply = responder(pages=pages, rates=rates)

    def respond(request: httpx.Request) -> httpx.Response:
        if kind == "json" and request.url.path == "/api/site/multicomplete.json":
            return httpx.Response(200, text="<html>captcha</html>")
        return reply(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        if kind in {"coordinates", "page_identity"}:
            assert await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") is None
        elif kind == "json":
            with pytest.raises(OfferProviderFailure):
                await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        else:
            result = await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
            assert result is not None
            assert result.offers == ()
            assert not result.rates_complete
        await provider.aclose()


async def test_foreign_residency_is_refused() -> None:
    async with httpx.AsyncClient(transport=site()) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        with pytest.raises(OfferProviderFailure):
            await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "de")
        await provider.aclose()


async def test_details_are_available_without_stay_dates() -> None:
    async with httpx.AsyncClient(transport=site()) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        found = await provider.details(HOTEL)
        assert found is not None
        assert found.details.facts.floors_number == 19
        assert [room.name for room in found.rooms] == ["Стандарт"]
        await provider.aclose()


async def test_two_listings_of_the_same_hotel_collapse_to_the_closest() -> None:
    twin = suggestion(master_id=42, otahotel_id="zhemchuzhina_twin")
    near = hotel_page()
    far = hotel_page(id="zhemchuzhina_twin", masterId="42")
    far["location"] = {**far["location"], "latitude": 43.5715}
    async with httpx.AsyncClient(
        transport=site([suggestion(), twin], {MASTER_ID: near, 42: far})
    ) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        result = await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert result is not None
        assert result.details is not None
        assert result.details.supplier_id == str(MASTER_ID)
        await provider.aclose()


async def test_bed_places_and_occupancy_come_from_the_rate() -> None:
    sleeping = rate(
        occupancy=2,
        bed_places={"main_count": 2, "extra_count": 1, "child_cot_count": 1},
        rooms=[
            {
                "amenities_data": ["non-smoking"],
                "bedding_data": ["twin"],
                "multi_bed_data": [{"bed": "single", "count": 2}],
            }
        ],
    )
    async with httpx.AsyncClient(transport=site(rates=[sleeping])) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        result = await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert result is not None
        [offer] = result.offers
        assert offer.occupancy == 2
        assert offer.bed_places is not None
        assert offer.bed_places.main == 2
        assert offer.bed_places.extra == 1
        assert offer.bed_places.child_cots == 1
        assert offer.bed_places.bedding == ("single", "twin")
        await provider.aclose()


async def test_rate_without_bed_places_keeps_them_unknown() -> None:
    async with httpx.AsyncClient(transport=site(rates=[rate(occupancy="two")])) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        result = await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert result is not None
        [offer] = result.offers
        assert offer.occupancy is None
        assert offer.bed_places is None
        await provider.aclose()


async def test_star_certificate_dates_the_registry_record() -> None:
    page = hotel_page(starCertificate={"certificateId": "С232024007508", "validTo": "2028-08-08"})
    async with httpx.AsyncClient(transport=site(pages={MASTER_ID: page})) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        found = await provider.details(HOTEL)
        assert found is not None
        registry = found.details.facts.registry
        assert registry is not None
        assert registry.record == "С232024007508"
        assert registry.valid_until == date(2028, 8, 8)
        await provider.aclose()


async def test_certificate_carries_the_record_when_the_register_is_absent() -> None:
    page = hotel_page(starCertificate={"certificateId": "С442024016365", "validTo": ""})
    page["facts"] = {key: value for key, value in page["facts"].items() if key != "register"}
    async with httpx.AsyncClient(transport=site(pages={MASTER_ID: page})) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        found = await provider.details(HOTEL)
        assert found is not None
        registry = found.details.facts.registry
        assert registry is not None
        assert registry.record == "С442024016365"
        assert registry.valid_until is None
        await provider.aclose()


async def test_two_same_named_hotels_apart_are_not_collapsed() -> None:
    twin = suggestion(master_id=42, otahotel_id="zhemchuzhina_twin")
    far = hotel_page(id="zhemchuzhina_twin", masterId="42")
    far["location"] = {**far["location"], "latitude": 43.5730}
    async with httpx.AsyncClient(
        transport=site([suggestion(), twin], {MASTER_ID: hotel_page(), 42: far})
    ) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        assert await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") is None
        await provider.aclose()
