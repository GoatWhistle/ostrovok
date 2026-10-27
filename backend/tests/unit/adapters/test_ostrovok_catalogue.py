from typing import Any

import pytest

from hotel_agent.adapters.external.ostrovok_catalog import suggestions
from hotel_agent.adapters.external.ostrovok_lookup import rank_suggestions, search_queries
from hotel_agent.adapters.external.ostrovok_page import details
from hotel_agent.domain.hotel_identity import HotelIdentity


def row(**changes: Any) -> dict[str, Any]:
    return {
        "master_id": 7374217,
        "otahotel_id": "zhemchuzhina_hotel_complex",
        "hotel_name": "Гостиничный Комплекс Жемчужина",
        "hotel_address": "улица Черноморская, д.3",
        "region_id": 5580,
        "region_name": "Сочи",
        "country_code": "RU",
        "slug": "russia/sochi",
        **changes,
    }


def test_suggestion_carries_identity_and_page_url() -> None:
    [found] = suggestions({"hotels": [row()]})
    assert found.master_id == 7374217
    assert found.ota_id == "zhemchuzhina_hotel_complex"
    assert found.city == "Сочи"
    assert found.region_id == 5580
    assert found.page_url == (
        "https://ostrovok.ru/hotel/russia/sochi/mid7374217/zhemchuzhina_hotel_complex/"
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"country_code": "KZ"},
        {"master_id": 0},
        {"master_id": True},
        {"otahotel_id": "../../etc"},
        {"slug": "russia"},
        {"slug": "/absolute/path"},
        {"hotel_name": "   "},
    ],
)
def test_unusable_rows_are_dropped(changes: dict[str, Any]) -> None:
    assert suggestions({"hotels": [row(**changes)]}) == ()


def test_duplicate_master_ids_collapse_and_missing_list_is_empty() -> None:
    assert len(suggestions({"hotels": [row(), row()]})) == 1
    assert suggestions({}) == ()


@pytest.mark.parametrize("payload", ["text", {"hotels": {}}, {"hotels": ["row"]}])
def test_broken_payloads_raise(payload: object) -> None:
    with pytest.raises((TypeError, ValueError)):
        suggestions(payload)


def test_queries_use_street_then_city_then_name_without_house_numbers() -> None:
    hotel = HotelIdentity(
        name='АК "Cosmos Adler Hotel"',
        address="улица Горького 56 с1",
        location=(39.7, 43.5),
        city="Сочи",
    )
    assert search_queries(hotel) == (
        "АК Cosmos Adler Hotel улица Горького",
        "АК Cosmos Adler Hotel Сочи",
        "АК Cosmos Adler Hotel",
    )


def test_queries_skip_unknown_street_and_city() -> None:
    hotel = HotelIdentity(name="Жемчужина", address=None, location=(39.7, 43.5))
    assert search_queries(hotel) == ("Жемчужина",)


def test_ranking_prefers_same_street_and_drops_unrelated_hotels() -> None:
    hotel = HotelIdentity(
        name="Жемчужина", address="Черноморская улица 3", location=(39.73, 43.57), city="Сочи"
    )
    found = suggestions(
        {
            "hotels": [
                row(master_id=1, hotel_name="Отель Лесной", hotel_address="улица Лесная, д.8"),
                row(master_id=2, hotel_name="Гостевой дом Жемчужина", hotel_address="ул Калараша"),
                row(),
            ]
        }
    )
    ranked = rank_suggestions(hotel, found)
    assert [item.master_id for item in ranked] == [7374217, 2]


def page(**changes: Any) -> dict[str, Any]:
    payload = {
        "name": "Гостиничный Комплекс Жемчужина",
        "location": {
            "address": "улица Черноморская, д.3, Сочи",
            "city": "Сочи",
            "latitude": 43.571,
            "longitude": 39.732,
            "pois": [
                {"name": "Зимний театр", "distance": 242, "poiSubtypeSlug": "CONCERTS"},
                {"name": "Пляж Жемчужина", "distance": 168, "poiSubtypeSlug": "BEACH"},
            ],
        },
        "serpFilters": ["HAS_POOL", "has_pool", "   "],
        "images": [
            {"tmpl": "https://cdn.ostrovok.ru/t/{size}/a.jpg", "category": "Beach"},
            {"tmpl": "http://cdn.ostrovok.ru/t/{size}/b.jpg"},
            {"tmpl": "https://evil.example/t/{size}/c.jpg"},
        ],
        "facts": {
            "floorsNumber": 0,
            "roomsNumber": 881,
            "starRating": 0,
            "yearBuilt": 1973,
            "hasHotelWifi": False,
            "register": {
                "record": "С232024007508",
                "link": "https://evil.example/record",
                "rooms": [
                    {"roomsCount": 736, "categoryType": "CT_FIRST_STANDARD"},
                    {"roomsCount": None, "categoryType": "CT_SUITE"},
                ],
            },
        },
        "amenityGroups": [
            {"name": "Общее", "amenities": [{"name": "Лифт", "isFree": 1}, {"name": "   "}]},
            {"name": "Пустая", "amenities": []},
        ],
        "descriptionStruct": [
            {"title": "Расположение", "paragraphs": ["Отель в Сочи.", "   "]},
            {"title": "Без текста", "paragraphs": []},
        ],
        "rating": {"total": 7.9, "reviewsCount": 302, "ostrovok": {"detailedRatings": {}}},
        "policies": {"checkInCheckOut": {"value": {"checkInTimeStart": {"hours": 15}}}},
        "contacts": {"email": "stay@example.test", "phone": "   "},
    }
    payload.update(changes)
    return payload


def test_page_details_keep_published_facts_and_drop_unknown_values() -> None:
    found = details(page(), "https://ostrovok.ru/hotel/x/", "7374217")
    assert found.location == (39.732, 43.571)
    assert found.city == "Сочи"
    assert found.facilities == ("has_pool",)
    assert [photo.url for photo in found.photos] == ["https://cdn.ostrovok.ru/t/1024x768/a.jpg"]
    assert found.photos[0].category == "Beach"
    assert found.facts.floors_number is None
    assert found.facts.rooms_number == 881
    assert found.facts.star_rating == 0
    assert found.facts.year_built == 1973
    assert found.facts.hotel_wifi is False
    assert found.facts.room_wifi is None
    assert found.facts.registry is not None
    assert found.facts.registry.link is None
    assert [item.rooms for item in found.facts.registry.categories] == [736]
    assert [group.name for group in found.amenity_groups] == ["Общее"]
    assert [item.name for item in found.amenity_groups[0].amenities] == ["Лифт"]
    assert [section.title for section in found.description] == ["Расположение"]
    assert found.description[0].paragraphs == ("Отель в Сочи.",)
    assert [place.name for place in found.nearby] == ["Пляж Жемчужина", "Зимний театр"]
    assert found.check_in_from == "15:00"
    assert found.check_out_until is None
    assert found.phone is None
    assert found.rating is not None
    assert found.rating.reviews_count == 302


@pytest.mark.parametrize(
    "location",
    [
        {"latitude": None, "longitude": 39.7},
        {"latitude": True, "longitude": 39.7},
        {"latitude": 95.0, "longitude": 39.7},
        {},
    ],
)
def test_unusable_coordinates_are_unknown(location: dict[str, Any]) -> None:
    found = details(page(location=location), "https://ostrovok.ru/hotel/x/", "1")
    assert found.location is None


def test_missing_name_is_refused() -> None:
    with pytest.raises(ValueError):
        details(page(name="  "), "https://ostrovok.ru/hotel/x/", "1")
