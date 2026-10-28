import asyncio
import json
from dataclasses import replace
from typing import cast

from hotel_agent.application.agent.provider_content import ProviderContent
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.hotel_offers import SupplierRoom
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.supplier_details import (
    SupplierAmenity,
    SupplierAmenityGroup,
    SupplierDescriptionSection,
    SupplierDetails,
    SupplierHotel,
    SupplierHotelFacts,
    SupplierNearbyPlace,
    SupplierPhoto,
    SupplierRegistry,
    SupplierRegistryCategory,
)
from hotel_agent.application.use_cases.get_hotel_details import (
    DetailsStatus,
    GetHotelDetails,
    HotelDetails,
)

HOTEL = SearchHotelRecord(
    id="w51847429",
    region_id="russia",
    name="Жемчужина",
    location=(39.732, 43.571),
    stars=4,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
    address="Черноморская улица 3",
)
FOUND = SupplierHotel(
    details=SupplierDetails(
        supplier_id="7374217",
        page_url="https://ostrovok.ru/hotel/russia/sochi/mid7374217/pearl/",
        name="Гостиничный Комплекс Жемчужина",
        address="улица Черноморская, д.3, Сочи",
        city="Сочи",
        location=(39.732, 43.571),
        photos=(SupplierPhoto(url="https://cdn.ostrovok.ru/t/1024x768/a.jpg"),),
        facts=SupplierHotelFacts(
            floors_number=19,
            rooms_number=881,
            registry=SupplierRegistry(
                record="С232024007508",
                categories=(SupplierRegistryCategory(category="CT_SUITE", rooms=1),),
            ),
        ),
        amenity_groups=(
            SupplierAmenityGroup(
                name="Бассейн и пляж",
                amenities=(
                    SupplierAmenity(name="Открытый бассейн", free=True),
                    SupplierAmenity(name="Шезлонги"),
                ),
            ),
        ),
        description=(
            SupplierDescriptionSection(title="Расположение", paragraphs=("Отель в Сочи.",)),
        ),
        nearby=(SupplierNearbyPlace(name="Пляж Жемчужина", distance_m=168, kind="BEACH"),),
    ),
    rooms=(
        SupplierRoom("3102302", "Стандарт", ("https://cdn.ostrovok.ru/room.jpg",), ("shower",), 17),
    ),
)


class Details:
    def __init__(self, result: SupplierHotel | None, fails: bool = False) -> None:
        self._result, self._fails = result, fails
        self.source = "Островок"
        self.calls: list[str] = []
        self.configured = True

    async def __call__(self, hotel_id: str) -> HotelDetails:
        self.calls.append(hotel_id)
        if self._fails:
            return HotelDetails(
                hotel_id=hotel_id, status=DetailsStatus.PROVIDER_ERROR, source=self.source
            )
        if self._result is None:
            return HotelDetails(
                hotel_id=hotel_id, status=DetailsStatus.HOTEL_UNMAPPED, source=self.source
            )
        return HotelDetails(
            hotel_id=hotel_id,
            status=DetailsStatus.AVAILABLE,
            source=self.source,
            details=self._result.details,
            rooms=self._result.rooms,
        )


def content(details: Details) -> ProviderContent:
    return ProviderContent(
        None,
        cast(UnitOfWorkFactory, None),
        lambda: [HOTEL],
        cast(GetHotelDetails, details),
    )


async def test_free_supplier_details_feed_hotel_and_room_records() -> None:
    details = Details(FOUND)
    tool = content(details)
    result = await tool.read(["w51847429"])
    assert result["hotels"] == [{"hotel_id": "w51847429", "status": "available"}]
    assert result["missing_room_hotel_ids"] == []
    assert result["unavailable"] is False
    [record] = tool.hotels
    assert record["source"] == "Островок"
    assert record["source_url"] == FOUND.details.page_url
    payload = json.loads(record["text"])
    assert payload["facts"]["floors_number"] == 19
    assert payload["facts"]["registry"]["rooms_by_category"] == {"CT_SUITE": 1}
    assert payload["amenities"]["Бассейн и пляж"] == ["Открытый бассейн (бесплатно)", "Шезлонги"]
    assert payload["nearby_m"] == {"Пляж Жемчужина": 168}
    assert payload["room_categories"] == ["Стандарт"]
    assert payload["description"].startswith("Расположение:")
    [room] = tool.rooms
    assert room["hotel_id"] == "w51847429"
    assert room["size_sqm"] == 17
    assert json.loads(room["text"])["amenities"] == ["shower"]


async def test_second_read_is_cached_and_does_not_call_the_site_again() -> None:
    details = Details(FOUND)
    tool = content(details)
    await tool.read(["w51847429"])
    again = await tool.read(["w51847429"])
    assert again["hotels"][0]["cached"] is True
    assert details.calls == ["w51847429"]


async def test_unmatched_hotel_is_reported_without_records() -> None:
    tool = content(Details(None))
    result = await tool.read(["w51847429"])
    assert result["hotels"] == [{"hotel_id": "w51847429", "status": "unmapped"}]
    assert result["missing_room_hotel_ids"] == ["w51847429"]
    assert tool.hotels == []


async def test_site_failure_is_not_reported_as_missing_data() -> None:
    tool = content(Details(None, fails=True))
    result = await tool.read(["w51847429"])
    assert result["hotels"] == [{"hotel_id": "w51847429", "status": "unavailable"}]
    assert result["unavailable"] is True


async def test_without_any_source_the_tool_says_it_is_not_configured() -> None:
    tool = ProviderContent(None, cast(UnitOfWorkFactory, None), lambda: [HOTEL])
    result = await tool.read(["w51847429"])
    assert result["unavailable"] is True
    assert result["missing_room_hotel_ids"] == ["w51847429"]


async def test_provider_hotels_are_checked_concurrently() -> None:
    arrived = 0
    both = asyncio.Event()

    class ConcurrentDetails(Details):
        async def __call__(self, hotel_id: str) -> HotelDetails:
            nonlocal arrived
            arrived += 1
            if arrived == 2:
                both.set()
            await both.wait()
            return await super().__call__(hotel_id)

    tool = ProviderContent(
        None,
        cast(UnitOfWorkFactory, None),
        lambda: [HOTEL, replace(HOTEL, id="other")],
        cast(GetHotelDetails, ConcurrentDetails(FOUND)),
    )
    async with asyncio.timeout(0.5):
        result = await tool.read([HOTEL.id, "other"])
    assert result["hotel_record_count"] == 2
