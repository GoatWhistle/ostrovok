from collections.abc import Callable, Sequence
from datetime import date
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.domain.errors import InvalidQuery


class RoomOfferTools:
    def __init__(
        self,
        offers: GetHotelOffers | None,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
    ) -> None:
        self._offers, self._hotels = offers, hotels
        self._metrics, self._descriptions = metrics, descriptions
        self._calls = 0

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._offers is None:
            return {"error": "Live room offers are unavailable"}
        if not all(arguments.get(key) for key in ("check_in", "check_out", "adults")):
            raise ValueError(
                "Supply check-in, check-out and number of adults; never invent stay details"
            )
        check_in = date.fromisoformat(str(arguments["check_in"]))
        check_out = date.fromisoformat(str(arguments["check_out"]))
        adults = int(arguments["adults"])
        if not 1 <= adults <= 10:
            raise ValueError("Adults must be 1–10")
        ids = arguments.get("hotel_ids") or []
        hotels = [h for h in self._hotels() if h.id in ids][:4]
        if not hotels:
            raise ValueError("Select 1–4 hotel_ids from the candidates")
        self._calls += 1
        prefix = f"offers{self._calls}"
        observations = []
        for hotel in hotels:
            try:
                result = await self._offers(hotel.id, check_in, check_out, adults, "ru")
            except InvalidQuery as error:
                raise ValueError(str(error)) from error
            observations.append(
                {
                    "hotel_id": hotel.id,
                    "status": str(result.status),
                    "sandbox": result.sandbox,
                    "source": result.source,
                    "checked_at": result.checked_at.isoformat() if result.checked_at else None,
                    "offers": [
                        {
                            "room": offer.room_name,
                            "total_price": offer.price_amount,
                            "currency": offer.price_currency,
                            "meal": offer.meal,
                            "amenities": offer.amenities,
                            "floor_number": offer.floor_number,
                        }
                        for offer in result.offers[:6]
                    ],
                }
            )
            if result.status not in {"available", "no_offers"}:
                continue
            suffix = " (тестовая выдача поставщика)" if result.sandbox else ""
            field = f"{prefix}.available_offers"
            self._metrics.setdefault(hotel.id, {})[field] = len(result.offers)
            self._descriptions[field] = (
                f"Предложений на {check_in}–{check_out}, {adults} взрослых{suffix}"
            )
            currencies = {offer.price_currency for offer in result.offers}
            for currency in currencies:
                field = f"{prefix}.min_total_price_{currency}"
                self._metrics[hotel.id][field] = float(
                    min(
                        offer.price_amount
                        for offer in result.offers
                        if offer.price_currency == currency
                    )
                )
                self._descriptions[field] = (
                    f"Цена за всё проживание {check_in}–{check_out} в {currency}, {adults} взрослых{suffix}"
                )
        return {
            "fields": {k: v for k, v in self._descriptions.items() if k.startswith(prefix + ".")},
            "hotels": observations,
            "check_in": str(check_in),
            "check_out": str(check_out),
            "note": "Prices are for the whole requested stay. Sandbox is demonstration inventory. Unmapped/error is unknown availability, not sold out. Do not compare different currencies without conversion.",
        }
