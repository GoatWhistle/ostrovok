from typing import Any

from hotel_agent.application.ports.hotel_offers import SupplierRoom
from hotel_agent.application.ports.supplier_details import (
    SupplierDetails,
    SupplierHotelFacts,
    SupplierPhoto,
)
from hotel_agent.application.use_cases.get_hotel_details import DetailsStatus, HotelDetails
from hotel_agent.interfaces.http.details_schemas import hotel_details_schema


def test_dateless_details_match_the_public_contract(validate: Any) -> None:
    result = HotelDetails(
        hotel_id="osm-hotel",
        status=DetailsStatus.AVAILABLE,
        source="Островок",
        sandbox=False,
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
            facts=SupplierHotelFacts(floors_number=19, rooms_number=881, star_rating=4),
        ),
        rooms=(
            SupplierRoom(
                "group-1",
                "Стандарт",
                ("https://cdn.ostrovok.ru/room.jpg",),
                ("shower",),
                17,
                "2 кровати",
            ),
        ),
    )

    payload = hotel_details_schema(result).model_dump(mode="json")

    validate("HotelDetails", payload)
    assert payload["details"]["photos"][0]["url"].startswith("https://cdn.ostrovok.ru/")
    assert payload["details"]["facts"]["rooms_number"] == 881
    assert payload["room_groups"][0]["bedding"] == "2 кровати"


def test_an_unmatched_hotel_is_an_honest_status_without_invented_content(validate: Any) -> None:
    payload = hotel_details_schema(
        HotelDetails(hotel_id="osm-hotel", status=DetailsStatus.HOTEL_UNMAPPED, source="Островок")
    ).model_dump(mode="json")

    validate("HotelDetails", payload)
    assert payload["status"] == "hotel_unmapped"
    assert payload["details"] is None
    assert payload["room_groups"] == []
