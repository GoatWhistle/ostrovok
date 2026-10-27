from datetime import UTC, date, datetime
from typing import Any

from hotel_agent.application.ports.hotel_offers import RoomOffer, SupplierRoom
from hotel_agent.application.ports.supplier_details import (
    SupplierAmenity,
    SupplierAmenityGroup,
    SupplierDescriptionSection,
    SupplierDetails,
    SupplierHotelFacts,
    SupplierNearbyPlace,
    SupplierPhoto,
    SupplierRating,
    SupplierRatingScore,
    SupplierRegistry,
    SupplierRegistryCategory,
)
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
        details=SupplierDetails(
            supplier_id="7374217",
            page_url="https://ostrovok.ru/hotel/russia/sochi/mid7374217/pearl/",
            name="Гостиничный Комплекс Жемчужина",
            address="улица Черноморская, д.3, Сочи",
            city="Сочи",
            location=(39.732, 43.571),
            photos=(
                SupplierPhoto(
                    url="https://cdn.ostrovok.ru/t/1024x768/hotel.jpg", category="Outside"
                ),
            ),
            facilities=("has_pool",),
            facts=SupplierHotelFacts(
                floors_number=19,
                rooms_number=881,
                star_rating=4,
                year_built=1973,
                registry=SupplierRegistry(
                    record="С232024007508",
                    link="https://tourism.fsa.gov.ru/ru/resorts/hotels/abc/about-resort",
                    categories=(SupplierRegistryCategory(category="CT_FIRST_STANDARD", rooms=736),),
                ),
            ),
            amenity_groups=(
                SupplierAmenityGroup(
                    name="Общее", amenities=(SupplierAmenity(name="Лифт", free=True),)
                ),
            ),
            description=(
                SupplierDescriptionSection(title="Расположение", paragraphs=("Отель в Сочи.",)),
            ),
            nearby=(SupplierNearbyPlace(name="Пляж Жемчужина", distance_m=168, kind="BEACH"),),
            rating=SupplierRating(
                total=7.9,
                reviews_count=302,
                detailed=(SupplierRatingScore(name="location", score=9.4),),
            ),
            check_in_from="15:00",
            check_out_until="12:00",
            email="stay@example.test",
            phone="+78622661188",
        ),
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
    details = payload["details"]
    assert details["facts"]["floors_number"] == 19
    assert details["facts"]["registry"]["categories"][0]["rooms"] == 736
    assert details["photos"][0]["category"] == "Outside"
    assert details["nearby"][0]["distance_m"] == 168
    assert details["amenity_groups"][0]["amenities"][0]["free"] is True
    assert details["location"] == [39.732, 43.571]
    assert details["rating"]["total"] == 7.9
