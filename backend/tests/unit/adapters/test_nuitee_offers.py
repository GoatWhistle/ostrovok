from datetime import date

import httpx
import pytest

from hotel_agent.adapters.external.nuitee_offers import NuiteeHotelOffers
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure


@pytest.mark.asyncio
async def test_nuitee_maps_price_board_and_unknown_allotment() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key"] == "sand_example"
        assert b'"hotelIds":["lp552d8"]' in request.content
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "hotelId": "lp552d8",
                        "roomTypes": [
                            {
                                "offerId": "offer-1",
                                "rateType": "standard",
                                "rates": [
                                    {
                                        "name": "Двухместный номер",
                                        "boardType": "BI",
                                        "retailRate": {
                                            "total": [{"amount": 12500.0, "currency": "RUB"}]
                                        },
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = NuiteeHotelOffers("sand_example", client)
        result = await provider.fetch("lp552d8", date(2026, 11, 1), date(2026, 11, 2), 2, "ru")

    assert provider.sandbox is True
    assert len(result.offers) == 1
    assert result.offers[0].price_amount == 12500
    assert result.offers[0].meal == "BI"
    assert result.offers[0].available_rooms is None


@pytest.mark.asyncio
async def test_nuitee_no_rates_does_not_claim_sold_out() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200, json={"error": {"code": 2001, "message": "no availability found"}}
            )
        )
    ) as client:
        result = await NuiteeHotelOffers("sand_example", client).fetch(
            "lp552d8", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
        )
    assert result.offers == ()


@pytest.mark.asyncio
async def test_nuitee_auth_error_is_provider_failure() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(401))
    ) as client:
        with pytest.raises(OfferProviderFailure):
            await NuiteeHotelOffers("sand_example", client).fetch(
                "lp552d8", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
            )
