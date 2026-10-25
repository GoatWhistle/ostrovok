from datetime import date

import httpx
import pytest

from hotel_agent.adapters.external.etg_offers import EtgHotelOffers
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure


@pytest.mark.asyncio
async def test_etg_offer_maps_live_price_meal_and_allotment() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/b2b/v3/search/hp/"
        assert b'"hid":42' in request.content
        assert b'"checkin":"2026-11-01"' in request.content
        return httpx.Response(
            200,
            json={
                "status": "ok",
                "error": None,
                "data": {
                    "hotels": [
                        {
                            "hid": 42,
                            "rates": [
                                {
                                    "book_hash": "rate-1",
                                    "room_name": "Двухместный номер",
                                    "allotment": 3,
                                    "amenities_data": ["has_wifi"],
                                    "meal_data": {"value": "all-inclusive"},
                                    "payment_options": {
                                        "payment_types": [
                                            {"show_amount": "12500.00", "show_currency_code": "RUB"}
                                        ]
                                    },
                                },
                                {"is_package": True},
                            ],
                        }
                    ]
                },
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await EtgHotelOffers("id", "secret", "sandbox", client).fetch(
            "42", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
        )
    assert len(result.offers) == 1
    offer = result.offers[0]
    assert offer.room_name == "Двухместный номер"
    assert offer.price_amount == 12500
    assert offer.available_rooms == 3
    assert offer.meal == "all-inclusive"
    assert offer.floor_number is None


@pytest.mark.asyncio
async def test_etg_error_does_not_look_like_sold_out() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"status": "error", "error": "limit"})
        )
    ) as client:
        with pytest.raises(OfferProviderFailure):
            await EtgHotelOffers("id", "secret", "sandbox", client).fetch(
                "42", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
            )
