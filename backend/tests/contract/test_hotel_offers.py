from datetime import UTC, date, datetime
from typing import Any

from hotel_agent.application.ports.hotel_offers import RoomOffer, SupplierRoom
from hotel_agent.application.use_cases.get_hotel_offers import HotelOffers, OfferStatus
from hotel_agent.interfaces.http.offer_schemas import hotel_offers_schema


def test_live_ostrovok_offer_matches_public_contract(validate: Any) -> None:
    result = HotelOffers(
        hotel_id="osm-hotel",
        check_in=date(2026, 11, 2),
        check_out=date(2026, 11, 4),
        adults=2,
        status=OfferStatus.AVAILABLE,
        source="Островок",
        sandbox=False,
        facilities=("has_pool",),
        room_categories=("Стандарт",),
        photo_url="https://cdn.ostrovok.ru/t/640x400/hotel.jpg",
        rates_complete=True,
        room_groups=(
            SupplierRoom(
                "group-1",
                "Стандарт",
                ("https://cdn.ostrovok.ru/room.jpg",),
                ("shower",),
                17,
                "2 кровати",
            ),
        ),
        checked_at=datetime(2026, 10, 26, tzinfo=UTC),
        offers=(RoomOffer("rate", "Двухместный номер", 12000, "RUB", None, "nomeal", ()),),
    )
    payload = hotel_offers_schema(result).model_dump(mode="json")
    validate("HotelOffers", payload)
    assert payload["offers"][0]["floor_number"] is None
    assert payload["offers"][0]["available_rooms"] is None
    assert payload["sandbox"] is False
    assert payload["facilities"] == ["has_pool"]
    assert payload["room_categories"] == ["Стандарт"]
    assert payload["room_groups"][0]["size_sqm"] == 17
    assert payload["rates_complete"] is True
