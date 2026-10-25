from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

import httpx

from hotel_agent.application.ports.hotel_offers import (
    OfferLookup,
    OfferProviderFailure,
    RoomOffer,
)

HOSTS = {
    "sandbox": "https://api-sandbox.ratehawk.com",
    "production": "https://api.ratehawk.com",
}
PATH = "/api/b2b/v3/search/hp/"


class EtgHotelOffers:
    def __init__(
        self, key_id: str, api_key: str, environment: str, client: httpx.AsyncClient | None = None
    ) -> None:
        self._auth = httpx.BasicAuth(key_id, api_key)
        self._url = HOSTS[environment] + PATH
        self._client = client

    async def fetch(
        self, supplier_id: int, check_in: date, check_out: date, adults: int, residency: str
    ) -> OfferLookup:
        payload = {
            "checkin": check_in.isoformat(),
            "checkout": check_out.isoformat(),
            "residency": residency,
            "language": "ru",
            "guests": [{"adults": adults, "children": []}],
            "hid": supplier_id,
            "currency": "RUB",
        }
        try:
            if self._client is None:
                async with httpx.AsyncClient(timeout=12) as client:
                    response = await client.post(self._url, json=payload, auth=self._auth)
            else:
                response = await self._client.post(self._url, json=payload, auth=self._auth)
            response.raise_for_status()
            body = response.json()
            if not isinstance(body, dict) or body.get("error") or body.get("status") != "ok":
                raise OfferProviderFailure()
            hotels = body["data"]["hotels"]
            if not isinstance(hotels, list):
                raise OfferProviderFailure()
            matching = next(
                (
                    hotel
                    for hotel in hotels
                    if isinstance(hotel, dict) and hotel.get("hid") == supplier_id
                ),
                None,
            )
            if matching is None and hotels:
                raise OfferProviderFailure()
            rates = matching.get("rates", []) if matching else []
            if not isinstance(rates, list):
                raise OfferProviderFailure()
            offers = tuple(
                self._offer(rate, index)
                for index, rate in enumerate(rates)
                if isinstance(rate, dict) and not rate.get("is_package", False)
            )
        except (httpx.HTTPError, KeyError, TypeError, ValueError, InvalidOperation) as exc:
            raise OfferProviderFailure() from exc
        return OfferLookup(offers=offers, checked_at=datetime.now(UTC))

    def _offer(self, rate: dict[str, object], index: int) -> RoomOffer:
        payment = rate["payment_options"]
        if not isinstance(payment, dict):
            raise OfferProviderFailure()
        options = payment["payment_types"]
        if not isinstance(options, list) or not options:
            raise OfferProviderFailure()
        priced = [
            option
            for option in options
            if isinstance(option, dict)
            and option.get("show_amount") is not None
            and option.get("show_currency_code")
        ]
        if not priced:
            raise OfferProviderFailure()
        best = min(priced, key=lambda option: Decimal(str(option["show_amount"])))
        amount = Decimal(str(best["show_amount"]))
        available = int(str(rate["allotment"]))
        name = str(rate["room_name"])
        currency = str(best["show_currency_code"])
        if not amount.is_finite() or amount < 0 or available < 0 or not name or len(currency) != 3:
            raise OfferProviderFailure()
        meal_data = rate.get("meal_data")
        meal = meal_data.get("value") if isinstance(meal_data, dict) else None
        amenities = rate.get("amenities_data", [])
        if not isinstance(amenities, list):
            raise OfferProviderFailure()
        return RoomOffer(
            id=str(rate.get("book_hash") or index),
            room_name=name,
            price_amount=float(amount),
            price_currency=currency,
            available_rooms=available,
            meal=str(meal) if meal is not None else None,
            amenities=tuple(str(item) for item in amenities),
        )
