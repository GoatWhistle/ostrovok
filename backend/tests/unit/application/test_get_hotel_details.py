from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.ports.hotel_offers import OfferProviderFailure, SupplierRoom
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.supplier_details import (
    SupplierDetails,
    SupplierHotel,
    SupplierPhoto,
)
from hotel_agent.application.use_cases.get_hotel_details import (
    CITY_RADIUS_M,
    DetailsStatus,
    GetHotelDetails,
)
from hotel_agent.domain.errors import HotelNotFound

FOUND = SupplierHotel(
    details=SupplierDetails(
        supplier_id="7374217",
        page_url="https://ostrovok.ru/hotel/russia/sochi/mid7374217/pearl/",
        name="Гостиничный Комплекс Жемчужина",
        address="улица Черноморская, д.3, Сочи",
        city="Сочи",
        location=(39.732, 43.571),
        photos=(SupplierPhoto(url="https://cdn.ostrovok.ru/t/1024x768/a.jpg"),),
    ),
    rooms=(SupplierRoom("3102302", "Стандарт", ("https://cdn.ostrovok.ru/room.jpg",), (), 17),),
)


def repository(city: str | None = None) -> tuple[UnitOfWorkFactory, SimpleNamespace]:
    search = SimpleNamespace(
        get_hotel=AsyncMock(
            return_value=SimpleNamespace(
                id="w51847429",
                name="Жемчужина",
                address="Черноморская 3",
                location=(39.73, 43.57),
                city=city,
            )
        ),
        nearby_city=AsyncMock(return_value="Сочи"),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(return_value=SimpleNamespace(search=search))
    scope.__aexit__ = AsyncMock(return_value=None)
    return cast(UnitOfWorkFactory, lambda: scope), search


def provider(result: SupplierHotel | None = None, fails: bool = False) -> SimpleNamespace:
    return SimpleNamespace(
        details=AsyncMock(side_effect=OfferProviderFailure("site down"))
        if fails
        else AsyncMock(return_value=result),
        source="Островок",
        sandbox=False,
    )


@pytest.mark.asyncio
async def test_photos_and_room_categories_come_back_without_dates() -> None:
    uow, _ = repository()
    result = await GetHotelDetails(uow, cast(Any, provider(FOUND)))("w51847429")

    assert result.status is DetailsStatus.AVAILABLE
    assert result.source == "Островок"
    assert result.details is not None
    assert [photo.url for photo in result.details.photos] == [
        "https://cdn.ostrovok.ru/t/1024x768/a.jpg"
    ]
    assert [room.name for room in result.rooms] == ["Стандарт"]


@pytest.mark.asyncio
async def test_city_is_taken_from_the_nearest_hotel_when_the_record_has_none() -> None:
    uow, search = repository(city=None)
    supplier = provider(FOUND)
    await GetHotelDetails(uow, cast(Any, supplier))("w51847429")

    search.nearby_city.assert_awaited_once_with((39.73, 43.57), CITY_RADIUS_M)
    assert supplier.details.await_args is not None
    assert supplier.details.await_args.args[0].city == "Сочи"


@pytest.mark.asyncio
async def test_own_city_is_used_without_a_nearby_lookup() -> None:
    uow, search = repository(city="Сочи")
    await GetHotelDetails(uow, cast(Any, provider(FOUND)))("w51847429")

    search.nearby_city.assert_not_awaited()


@pytest.mark.asyncio
async def test_unmatched_hotel_is_not_reported_as_a_provider_error() -> None:
    uow, _ = repository()
    result = await GetHotelDetails(uow, cast(Any, provider(None)))("w51847429")

    assert result.status is DetailsStatus.HOTEL_UNMAPPED
    assert result.details is None
    assert result.rooms == ()


@pytest.mark.asyncio
async def test_site_failure_is_a_provider_error_not_an_empty_hotel() -> None:
    uow, _ = repository()
    result = await GetHotelDetails(uow, cast(Any, provider(fails=True)))("w51847429")

    assert result.status is DetailsStatus.PROVIDER_ERROR
    assert result.details is None


@pytest.mark.asyncio
async def test_without_a_provider_the_status_says_so_and_nothing_is_read() -> None:
    uow, search = repository()
    result = await GetHotelDetails(uow, None)("w51847429")

    assert result.status is DetailsStatus.PROVIDER_UNAVAILABLE
    search.get_hotel.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_hotel_is_rejected() -> None:
    uow, search = repository()
    search.get_hotel = AsyncMock(return_value=None)

    with pytest.raises(HotelNotFound):
        await GetHotelDetails(uow, cast(Any, provider(FOUND)))("nope")
