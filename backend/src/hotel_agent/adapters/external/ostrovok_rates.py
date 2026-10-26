from decimal import Decimal, InvalidOperation
from typing import Any

from hotel_agent.application.ports.hotel_offers import OfferProviderFailure, RoomOffer
from hotel_agent.domain.hotel_identity import HotelCandidate, HotelIdentity


def site_candidate(row: dict[str, Any]) -> HotelCandidate:
    info = row["static_vm"]
    name, lon, lat = info["name"], info["longitude"], info["latitude"]
    if (
        not isinstance(name, str)
        or not name.strip()
        or isinstance(lon, bool)
        or isinstance(lat, bool)
        or not isinstance(lon, (float, int))
        or not isinstance(lat, (float, int))
    ):
        raise ValueError("Missing hotel identity")
    address = info.get("address")
    return HotelCandidate(
        supplier_id=str(row["master_id"]),
        identity=HotelIdentity(
            name=name,
            address=address if isinstance(address, str) else None,
            location=(float(lon), float(lat)),
        ),
    )


def site_offers(row: dict[str, Any]) -> tuple[RoomOffer, ...]:
    try:
        rates = row["rates"]
        if not isinstance(rates, list):
            raise TypeError("Invalid rates")
        offers: dict[tuple[str, str, str | None, tuple[str, ...]], RoomOffer] = {}
        for rate in rates:
            if not isinstance(rate, dict):
                raise TypeError("Invalid rate")
            offer = _offer(rate)
            key = (offer.room_name, offer.price_currency, offer.meal, offer.amenities)
            if key not in offers or offer.price_amount < offers[key].price_amount:
                offers[key] = offer
        return tuple(sorted(offers.values(), key=lambda offer: offer.price_amount))
    except (KeyError, TypeError, ValueError, InvalidOperation) as error:
        raise OfferProviderFailure("Invalid Ostrovok website rates") from error


def _offer(rate: dict[str, Any]) -> RoomOffer:
    name, rate_id = rate.get("room_name"), rate.get("hash")
    if not isinstance(name, str) or not name.strip() or not isinstance(rate_id, str) or not rate_id:
        raise ValueError("Missing room name or rate ID")
    payments = rate["payment_options"]["payment_types"]
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
        if not amount.is_finite() or amount <= 0 or currency != "RUB":
            raise ValueError("Invalid RUB price")
        priced.append((amount, currency))
    if not priced:
        raise ValueError("No enabled payment")
    amount, currency = min(priced)
    rooms = rate.get("rooms", [])
    if not isinstance(rooms, list) or any(not isinstance(room, dict) for room in rooms):
        raise ValueError("Invalid room details")
    amenities = {
        amenity
        for room in rooms
        for amenity in room.get("amenities_data", [])
        if isinstance(amenity, str)
    }
    meal_data = rate.get("meal_data", {})
    meals = meal_data.get("meals", [])
    if not isinstance(meals, list):
        raise TypeError("Invalid meal data")
    meal_values = {meal.get("value") for meal in meals if isinstance(meal, dict)}
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
    )
