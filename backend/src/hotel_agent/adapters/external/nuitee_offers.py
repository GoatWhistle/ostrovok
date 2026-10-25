from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

import httpx

from hotel_agent.application.ports.hotel_offers import (
    OfferLookup,
    OfferProviderFailure,
    RoomOffer,
)

URL = "https://api.liteapi.travel/v3.0/hotels/rates"


class NuiteeHotelOffers:
    supplier = "nuitee"
    source = "Nuitee Connect"

    def __init__(self, api_key: str, client: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._client = client
        self.sandbox = api_key.startswith("sand_")

    async def fetch(
        self, supplier_id: str, check_in: date, check_out: date, adults: int, residency: str
    ) -> OfferLookup:
        payload = {
            "hotelIds": [supplier_id],
            "occupancies": [{"adults": adults}],
            "currency": "RUB",
            "guestNationality": residency.upper(),
            "checkin": check_in.isoformat(),
            "checkout": check_out.isoformat(),
            "maxRatesPerHotel": 10,
            "roomMapping": True,
        }
        headers = {"X-API-Key": self._api_key}
        try:
            if self._client is None:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.post(URL, json=payload, headers=headers)
            else:
                response = await self._client.post(URL, json=payload, headers=headers)
            response.raise_for_status()
            body = response.json()
            if not isinstance(body, dict):
                raise OfferProviderFailure()
            error = body.get("error")
            if isinstance(error, dict) and error.get("code") == 2001:
                return OfferLookup(offers=(), checked_at=datetime.now(UTC))
            if error:
                raise OfferProviderFailure()
            hotels = body["data"]
            if not isinstance(hotels, list):
                raise OfferProviderFailure()
            hotel = next(
                (
                    item
                    for item in hotels
                    if isinstance(item, dict) and item.get("hotelId") == supplier_id
                ),
                None,
            )
            if hotel is None:
                raise OfferProviderFailure()
            room_types = hotel["roomTypes"]
            if not isinstance(room_types, list):
                raise OfferProviderFailure()
            offers = tuple(
                self._offer(room_type, rate)
                for room_type in room_types
                if isinstance(room_type, dict) and room_type.get("rateType") != "package"
                for rate in room_type.get("rates", [])
                if isinstance(rate, dict)
            )
        except (httpx.HTTPError, KeyError, TypeError, ValueError, InvalidOperation) as exc:
            raise OfferProviderFailure() from exc
        return OfferLookup(offers=offers, checked_at=datetime.now(UTC))

    def _offer(self, room_type: dict[str, object], rate: dict[str, object]) -> RoomOffer:
        retail = rate["retailRate"]
        if not isinstance(retail, dict):
            raise OfferProviderFailure()
        totals = retail["total"]
        if not isinstance(totals, list) or not totals or not isinstance(totals[0], dict):
            raise OfferProviderFailure()
        total = totals[0]
        amount = Decimal(str(total["amount"]))
        currency = str(total["currency"])
        name = str(rate["name"])
        if not amount.is_finite() or amount < 0 or len(currency) != 3 or not name:
            raise OfferProviderFailure()
        return RoomOffer(
            id=str(room_type["offerId"]),
            room_name=name,
            price_amount=float(amount),
            price_currency=currency,
            available_rooms=None,
            meal=str(rate["boardType"]) if rate.get("boardType") else None,
            amenities=(),
        )
