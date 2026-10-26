import asyncio
import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
import pytest

from hotel_agent.adapters.external.ostrovok_offers import OstrovokHotelOffers
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure
from hotel_agent.domain.hotel_identity import HotelIdentity

HOTEL = HotelIdentity(name="Жемчужина", address="Черноморская улица 3", location=(39.732, 43.571))
CHECK_IN, CHECK_OUT = date(2026, 11, 2), date(2026, 11, 4)


@dataclass
class Clock:
    value: datetime = datetime(2026, 10, 26, tzinfo=UTC)

    def now(self) -> datetime:
        return self.value


def hotel_row() -> dict[str, Any]:
    return {
        "master_id": 7374217,
        "static_vm": {
            "name": "Гостиничный Комплекс Жемчужина",
            "address": "улица Черноморская, д.3, Сочи",
            "longitude": 39.732,
            "latitude": 43.571,
        },
        "rates": [
            {
                "hash": "rate-1",
                "room_name": "Двухместный номер с балконом",
                "payment_options": {
                    "payment_types": [{"show_amount": "12000.00", "show_currency_code": "RUB"}]
                },
                "meal_data": {"meals": [{"value": "breakfast", "has_breakfast": True}]},
                "rooms": [{"amenities_data": ["non-smoking"]}],
            }
        ],
    }


def page(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {"hotels": rows, "total_av_hotels": len(rows), "search_finished": True}


async def test_real_protocol_preserves_price_meal_and_unknown_floor_and_caches() -> None:
    requests: list[httpx.Request] = []
    row = hotel_row()
    expensive = deepcopy(row["rates"][0])
    expensive["hash"] = "expensive"
    expensive["payment_options"]["payment_types"][0]["show_amount"] = "15000"
    row["rates"].append(expensive)

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "GET":
            payload = json.loads(request.url.params["body"])
            params = payload["session_params"]
            assert params["arrival_date"] == "2026-11-02"
            assert params["departure_date"] == "2026-11-04"
            assert params["paxes"] == [{"adults": 2}]
            assert params["upper_left_corner"]["lat"] > HOTEL.location[1]
            assert params["down_right_corner"]["lng"] > HOTEL.location[0]
            assert "authorization" not in request.headers
            return httpx.Response(200, json={"session_info": {"session": {"id": "session-1"}}})
        assert request.url.params["session"] == "session-1"
        assert json.loads(request.content)["filters"] == {"hotel_name": "Жемчужина"}
        return httpx.Response(200, json=page([row]))

    clock = Clock()
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OstrovokHotelOffers(clock, client)
        result = await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert result is not None
        [offer] = result.offers
        assert offer.price_amount == 12000
        assert offer.price_currency == "RUB"
        assert offer.meal == "breakfast"
        assert offer.amenities == ("non-smoking",)
        assert offer.available_rooms is None
        assert offer.floor_number is None
        assert result.checked_at == clock.now()
        assert await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") is result
        assert len(requests) == 2
        clock.value += timedelta(minutes=11)
        await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        assert len(requests) == 4
        await provider.aclose()
        assert not client.is_closed


@pytest.mark.parametrize("kind", ["address", "name", "far", "ambiguous", "empty"])
async def test_unconfirmed_identity_never_returns_another_hotels_prices(kind: str) -> None:
    row = hotel_row()
    rows = [row]
    if kind == "address":
        row["static_vm"]["address"] = "Черноморская улица 33"
    elif kind == "name":
        row["static_vm"]["name"] = "Другая гостиница"
    elif kind == "far":
        row["static_vm"]["latitude"] += 0.1
    elif kind == "ambiguous":
        duplicate = deepcopy(row)
        duplicate["master_id"] = 42
        rows.append(duplicate)
    else:
        rows = []

    def respond(request: httpx.Request) -> httpx.Response:
        body = {"session_info": {"session": {"id": "session"}}}
        return httpx.Response(200, json=body if request.method == "GET" else page(rows))

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
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


async def test_concurrent_requests_share_search_but_different_guests_get_new_prices() -> None:
    requests: list[httpx.Request] = []

    async def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        await asyncio.sleep(0)
        body = {"session_info": {"session": {"id": "session"}}}
        return httpx.Response(200, json=body if request.method == "GET" else page([hotel_row()]))

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        results = await asyncio.gather(
            *(provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru") for _ in range(4))
        )
        assert len(requests) == 2
        assert all(result is results[0] for result in results)
        await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 3, "ru")
        assert len(requests) == 4
        await provider.search(HOTEL, CHECK_IN, CHECK_OUT + timedelta(days=1), 2, "ru")
        assert len(requests) == 6
        await provider.aclose()


async def test_truncated_search_is_an_error_even_when_first_page_has_a_match() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        body = {"session_info": {"session": {"id": "session"}}}
        truncated = {**page([hotel_row()]), "total_av_hotels": 21}
        return httpx.Response(200, json=body if request.method == "GET" else truncated)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        with pytest.raises(OfferProviderFailure):
            await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        await provider.aclose()


@pytest.mark.parametrize("kind", ["price", "currency", "json", "coordinates", "rates"])
async def test_invalid_provider_data_is_not_accepted(kind: str) -> None:
    row = hotel_row()
    if kind == "price":
        row["rates"][0]["payment_options"]["payment_types"][0]["show_amount"] = "NaN"
    elif kind == "currency":
        row["rates"][0]["payment_options"]["payment_types"][0]["show_currency_code"] = "USD"
    elif kind == "coordinates":
        row["static_vm"]["latitude"] = None
    elif kind == "rates":
        row["rates"] = None

    def respond(request: httpx.Request) -> httpx.Response:
        if kind == "json":
            return httpx.Response(200, text="<html>captcha</html>")
        body = {"session_info": {"session": {"id": "session"}}}
        return httpx.Response(200, json=body if request.method == "GET" else page([row]))

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OstrovokHotelOffers(Clock(), client)
        with pytest.raises(OfferProviderFailure):
            await provider.search(HOTEL, CHECK_IN, CHECK_OUT, 2, "ru")
        await provider.aclose()
