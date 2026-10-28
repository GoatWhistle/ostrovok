import math
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from hotel_agent.application.ports.hotel_offers import (
    BedPlaces,
    OfferProviderFailure,
    RoomOffer,
)


def site_offers(row: dict[str, Any], *, all_rates: bool = False) -> tuple[RoomOffer, ...]:
    try:
        rates = row["rates"]
        if not isinstance(rates, list):
            raise TypeError("Invalid rates")
        offers: dict[object, RoomOffer] = {}
        for rate in rates:
            if not isinstance(rate, dict):
                raise TypeError("Invalid rate")
            offer = _offer(rate)
            if offer.available_rooms == 0:
                continue
            key = (
                offer.id
                if all_rates
                else (offer.room_name, offer.price_currency, offer.meal, offer.amenities)
            )
            if key not in offers or offer.price_amount < offers[key].price_amount:
                offers[key] = offer
        return tuple(sorted(offers.values(), key=lambda offer: offer.price_amount))
    except (KeyError, TypeError, ValueError, InvalidOperation) as error:
        raise OfferProviderFailure("Invalid Ostrovok website rates") from error


def _offer(rate: dict[str, Any]) -> RoomOffer:
    name, rate_id = rate.get("room_name"), rate.get("hash")
    if not isinstance(name, str) or not name.strip() or not isinstance(rate_id, str) or not rate_id:
        raise ValueError("Missing room name or rate ID")
    payment_options = rate["payment_options"]
    if not isinstance(payment_options, dict):
        raise TypeError("Invalid payment options")
    payments = payment_options["payment_types"]
    if not isinstance(payments, list) or not payments:
        raise ValueError("Missing prices")
    priced: list[tuple[Decimal, str]] = []
    for payment in payments:
        if not isinstance(payment, dict):
            raise TypeError("Invalid payment")
        if payment.get("is_enabled") is False:
            continue
        amount = Decimal(str(payment["show_amount"]))
        currency = payment["show_currency_code"]
        if (
            not amount.is_finite()
            or not math.isfinite(float(amount))
            or amount <= 0
            or currency != "RUB"
        ):
            raise ValueError("Invalid RUB price")
        priced.append((amount, currency))
    if not priced:
        raise ValueError("No enabled payment")
    amount, currency = min(priced)
    rooms = rate.get("rooms", [])
    if not isinstance(rooms, list) or any(not isinstance(room, dict) for room in rooms):
        raise ValueError("Invalid room details")
    amenities: set[str] = set()
    for room in rooms:
        values = room.get("amenities_data", [])
        if not isinstance(values, list) or any(not isinstance(item, str) for item in values):
            raise TypeError("Invalid amenities")
        amenities.update(values)
    meal_data = rate.get("meal_data", {})
    if not isinstance(meal_data, dict):
        raise TypeError("Invalid meal data")
    meals = meal_data.get("meals", [])
    if not isinstance(meals, list) or any(not isinstance(meal, dict) for meal in meals):
        raise TypeError("Invalid meal data")
    values = [meal.get("value") for meal in meals]
    if any(value is not None and not isinstance(value, str) for value in values):
        raise TypeError("Invalid meal code")
    meal_values = set(values)
    meal = next(iter(meal_values)) if len(meal_values) == 1 else None
    if meal is not None and not isinstance(meal, str):
        raise ValueError("Invalid meal code")
    available = rate.get("allotment")
    if available is not None and (
        isinstance(available, bool) or not isinstance(available, int) or available < 0
    ):
        raise ValueError("Invalid room allotment")
    return RoomOffer(
        id=rate_id,
        room_name=name.strip(),
        price_amount=float(amount),
        price_currency=currency,
        available_rooms=available,
        meal=meal,
        amenities=tuple(sorted(amenities)),
        room_group_id=rooms[0].get("rg_hash")
        if len(rooms) == 1 and isinstance(rooms[0].get("rg_hash"), str)
        else None,
        free_cancellation_before=_cancellation(rate),
        occupancy=_count(rate.get("occupancy")),
        bed_places=_bed_places(rate, rooms),
    )


def _bed_places(rate: dict[str, Any], rooms: list[dict[str, Any]]) -> BedPlaces | None:
    places = rate.get("bed_places")
    if not isinstance(places, dict):
        return None
    main = _count(places.get("main_count"))
    if main is None:
        return None
    bedding: set[str] = set()
    for room in rooms:
        for code in _items(room.get("bedding_data")):
            if isinstance(code, str) and code.strip():
                bedding.add(code.strip())
        for entry in _items(room.get("multi_bed_data")):
            bed = entry.get("bed") if isinstance(entry, dict) else None
            if isinstance(bed, str) and bed.strip():
                bedding.add(bed.strip())
    return BedPlaces(
        main=main,
        extra=_count(places.get("extra_count")) or 0,
        child_cots=_count(places.get("child_cot_count")) or 0,
        bedding=tuple(sorted(bedding)),
    )


def _items(value: object) -> list[Any]:
    return list(value) if isinstance(value, list) else []


def _count(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value


def _cancellation(rate: dict[str, Any]) -> datetime | None:
    info = rate.get("cancellation_info")
    value = info.get("free_cancellation_before") if isinstance(info, dict) else None
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo is not None else None
    except ValueError:
        return None
