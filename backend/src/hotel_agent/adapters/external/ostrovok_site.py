import json
from datetime import date
from typing import Any
from uuid import uuid4

import httpx

from hotel_agent.adapters.external.ostrovok_lookup import OstrovokLookup, ResolvedHotel
from hotel_agent.adapters.external.ostrovok_rates import site_offers
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure, RoomOffer
from hotel_agent.domain.hotel_identity import HotelIdentity

SITE = "https://ostrovok.ru"
RATES = SITE + "/hotel/search/v1/site/hp/search"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
}


class OstrovokSite:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(timeout=15, headers=HEADERS)
        self._owns_client = client is None
        self._lookup = OstrovokLookup(self._client)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def resolve(self, hotel: HotelIdentity) -> ResolvedHotel | None:
        try:
            return await self._lookup.resolve(hotel)
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise OfferProviderFailure("Ostrovok catalogue lookup failed") from error

    async def rates(
        self, resolved: ResolvedHotel, check_in: date, check_out: date, adults: int
    ) -> dict[str, Any]:
        suggestion = resolved.suggestion
        body = {
            "hotel": suggestion.ota_id,
            "arrival_date": str(check_in),
            "departure_date": str(check_out),
            "currency": "RUB",
            "lang": "ru",
            "region_id": suggestion.region_id or 153,
            "paxes": [{"adults": adults}],
            "search_uuid": str(uuid4()),
            "guru_auth_prices_enabled": False,
        }
        response = await self._client.get(RATES, params={"body": json.dumps(body)}, timeout=25)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise TypeError("Invalid rate response")
        if data.get("ota_hotel_id") != suggestion.ota_id or str(data.get("master_id")) != str(
            suggestion.master_id
        ):
            raise ValueError("Rate hotel identity mismatch")
        rates = data.get("rates")
        if not isinstance(rates, list) or any(
            not isinstance(rate, dict) or rate.get("hotel_id") != suggestion.ota_id
            for rate in rates
        ):
            raise ValueError("Invalid hotel rates")
        return data

    async def offers(
        self, resolved: ResolvedHotel, check_in: date, check_out: date, adults: int
    ) -> tuple[RoomOffer, ...]:
        try:
            return site_offers(
                await self.rates(resolved, check_in, check_out, adults), all_rates=True
            )
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise OfferProviderFailure("Ostrovok rate lookup failed") from error
