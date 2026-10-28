from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import (
    HotelOfferSearchPort,
    OfferLookup,
    OfferProviderFailure,
    RoomOffer,
)
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers, OfferStatus
from hotel_agent.application.use_cases.match_hotel_catalog import CatalogMatch, MatchHotelCatalog
from hotel_agent.domain.errors import InvalidQuery


def repository(supplier_id: str | None) -> UnitOfWorkFactory:
    search = SimpleNamespace(
        get_hotel=AsyncMock(
            return_value=SimpleNamespace(
                id="hotel-1",
                name="Жемчужина",
                address="Черноморская 3",
                location=(39.73, 43.57),
                city=None,
            )
        ),
        get_supplier_id=AsyncMock(return_value=supplier_id),
        nearby_city=AsyncMock(return_value="Сочи"),
        save_declared_rooms=AsyncMock(),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(return_value=SimpleNamespace(search=search, commit=AsyncMock()))
    scope.__aexit__ = AsyncMock(return_value=None)
    return cast(UnitOfWorkFactory, lambda: scope)


def clock() -> ClockPort:
    return cast(ClockPort, SimpleNamespace(now=lambda: datetime(2026, 10, 25, tzinfo=UTC)))


@pytest.mark.asyncio
async def test_unconfigured_provider_is_not_reported_as_sold_out() -> None:
    result = await GetHotelOffers(repository(None), None, clock())(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is OfferStatus.PROVIDER_UNAVAILABLE
    assert result.offers == ()


@pytest.mark.asyncio
async def test_unmapped_hotel_does_not_call_supplier() -> None:
    provider = SimpleNamespace(
        fetch=AsyncMock(), supplier="nuitee", source="Nuitee Connect", sandbox=True
    )
    result = await GetHotelOffers(repository(None), cast(Any, provider), clock())(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is OfferStatus.HOTEL_UNMAPPED
    provider.fetch.assert_not_called()


@pytest.mark.parametrize(
    ("outcome", "expected"),
    [
        ("rates", OfferStatus.AVAILABLE),
        ("empty", OfferStatus.NO_OFFERS),
        ("unmapped", OfferStatus.HOTEL_UNMAPPED),
        ("error", OfferStatus.PROVIDER_ERROR),
    ],
)
async def test_free_site_search_uses_local_identity_and_preserves_unknown_states(
    outcome: str, expected: OfferStatus
) -> None:
    rate = RoomOffer("rate", "Номер", 12000, "RUB", None, "nomeal", ())
    lookup = (
        None
        if outcome == "unmapped"
        else OfferLookup((rate,) if outcome == "rates" else (), datetime(2026, 10, 25, tzinfo=UTC))
    )
    search = AsyncMock(return_value=lookup)
    if outcome == "error":
        search.side_effect = OfferProviderFailure()
    source = cast(
        HotelOfferSearchPort, SimpleNamespace(search=search, source="Островок", sandbox=False)
    )
    result = await GetHotelOffers(repository(None), None, clock(), search_provider=source)(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is expected
    assert result.source == "Островок"
    assert result.sandbox is False
    identity = search.call_args.args[0]
    assert identity.name == "Жемчужина"
    assert identity.address == "Черноморская 3"
    assert identity.location == (39.73, 43.57)
    assert result.offers == ((rate,) if outcome == "rates" else ())


@pytest.mark.asyncio
async def test_mapped_hotel_returns_provider_rate() -> None:
    checked_at = datetime(2026, 10, 25, tzinfo=UTC)
    rate = RoomOffer(
        id="rate-1",
        room_name="Двухместный номер",
        price_amount=12000,
        price_currency="RUB",
        available_rooms=2,
        meal="breakfast",
        amenities=(),
    )
    provider = SimpleNamespace(
        fetch=AsyncMock(return_value=OfferLookup((rate,), checked_at)),
        supplier="nuitee",
        source="Nuitee Connect",
        sandbox=True,
    )
    result = await GetHotelOffers(repository("42"), cast(Any, provider), clock())(
        "hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru"
    )
    assert result.status is OfferStatus.AVAILABLE
    assert result.offers == (rate,)
    assert result.sandbox is True
    provider.fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_invalid_dates_are_rejected_before_supplier_call() -> None:
    with pytest.raises(InvalidQuery):
        await GetHotelOffers(repository("42"), None, clock())(
            "hotel-1", date(2026, 11, 2), date(2026, 11, 1), 2, "ru"
        )


@pytest.mark.asyncio
async def test_unmapped_nuitee_hotel_is_matched_before_requesting_rates() -> None:
    provider = SimpleNamespace(
        fetch=AsyncMock(return_value=OfferLookup((), datetime(2026, 10, 25, tzinfo=UTC))),
        supplier="nuitee",
        source="Nuitee Connect",
        sandbox=True,
    )
    matcher = AsyncMock(
        return_value=CatalogMatch(
            hotel_id="hotel-1",
            status="imported",
            supplier_id="new-id",
            imported_rooms=2,
        )
    )
    result = await GetHotelOffers(
        repository(None), cast(Any, provider), clock(), cast(MatchHotelCatalog, matcher)
    )(
        "hotel-1",
        date(2026, 11, 1),
        date(2026, 11, 2),
        2,
        "ru",
    )
    assert result.status is OfferStatus.NO_OFFERS
    matcher.assert_awaited_once_with("hotel-1", persist=True)
    provider.fetch.assert_awaited_once_with("new-id", date(2026, 11, 1), date(2026, 11, 2), 2, "ru")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("match_status", "offer_status"),
    [
        ("ambiguous", OfferStatus.HOTEL_UNMAPPED),
        ("incomplete", OfferStatus.HOTEL_UNMAPPED),
        ("not_found", OfferStatus.HOTEL_UNMAPPED),
        ("mapping_conflict", OfferStatus.HOTEL_UNMAPPED),
        ("provider_error", OfferStatus.PROVIDER_ERROR),
    ],
)
async def test_failed_matching_never_fetches_rates_from_a_different_hotel(
    match_status: str,
    offer_status: OfferStatus,
) -> None:
    provider = SimpleNamespace(fetch=AsyncMock(), supplier="nuitee", source="Nuitee", sandbox=True)
    matcher = AsyncMock(return_value=CatalogMatch(hotel_id="hotel-1", status=match_status))
    result = await GetHotelOffers(
        repository(None), cast(Any, provider), clock(), cast(MatchHotelCatalog, matcher)
    )(
        "hotel-1",
        date(2026, 11, 1),
        date(2026, 11, 2),
        2,
        "ru",
    )
    assert result.status is offer_status
    provider.fetch.assert_not_called()


@pytest.mark.asyncio
async def test_web_card_fills_an_unmatched_hotel_without_claiming_rates() -> None:
    from hotel_agent.application.ports.hotel_web_card import HotelCardLookupPort
    from hotel_agent.application.ports.supplier_details import SupplierDetails, SupplierHotel

    details = SupplierDetails(
        supplier_id="hotelsouz.ru",
        page_url="https://hotelsouz.ru/",
        name="Отель Союз",
        address="Шереметевский проспект 47Б",
        location=(40.9869, 57.0034),
    )
    card = SimpleNamespace(find=AsyncMock(return_value=SupplierHotel(details=details)))
    search = SimpleNamespace(
        search=AsyncMock(return_value=None),
        details=AsyncMock(return_value=None),
        aclose=AsyncMock(),
        source="Островок",
        sandbox=False,
    )
    result = await GetHotelOffers(
        repository(None),
        None,
        clock(),
        search_provider=cast(HotelOfferSearchPort, search),
        card_lookup=cast(HotelCardLookupPort, card),
    )("hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru")

    assert result.status is OfferStatus.NO_OFFERS
    assert result.offers == ()
    assert result.details is not None
    assert result.details.page_url == "https://hotelsouz.ru/"
    assert result.source == "hotelsouz.ru"
    card.find.assert_awaited_once()
    assert card.find.await_args is not None
    assert card.find.await_args.args[0].city == "Сочи"


@pytest.mark.asyncio
async def test_declared_rooms_add_views_the_matched_supplier_does_not_publish() -> None:
    from hotel_agent.application.ports.hotel_web_card import HotelCardLookupPort
    from hotel_agent.application.ports.supplier_details import (
        SupplierDetails,
        SupplierHotel,
        SupplierRoom,
    )

    plain = SupplierRoom(id="rg1", name="Стандарт", photos=(), amenities=())
    declared = SupplierRoom(
        id="alean:1", name="Люкс", photos=(), amenities=(), views=("sea",), floor=4
    )
    card = SimpleNamespace(
        find=AsyncMock(
            return_value=SupplierHotel(
                details=SupplierDetails(
                    supplier_id="www.alean.ru",
                    page_url="https://www.alean.ru/hotels/rossiya/a/b/c/d/",
                    name="Отель",
                    location=(39.7, 43.6),
                ),
                rooms=(declared,),
            )
        )
    )
    search = SimpleNamespace(
        search=AsyncMock(
            return_value=OfferLookup(
                offers=(),
                checked_at=datetime(2026, 10, 25, tzinfo=UTC),
                room_groups=(plain,),
            )
        ),
        details=AsyncMock(return_value=None),
        aclose=AsyncMock(),
        source="Островок",
        sandbox=False,
    )
    offers = GetHotelOffers(
        repository(None),
        None,
        clock(),
        search_provider=cast(HotelOfferSearchPort, search),
        room_card=cast(HotelCardLookupPort, card),
    )
    result = await offers("hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru")

    assert result.room_groups == (plain,)
    assert result.declared_rooms == (declared,)
    assert result.declared_card == "https://www.alean.ru/hotels/rossiya/a/b/c/d/"

    with_views = SupplierRoom(
        id="rg2", name="Люкс с видом на море", photos=(), amenities=(), views=("sea",)
    )
    search.search = AsyncMock(
        return_value=OfferLookup(
            offers=(),
            checked_at=datetime(2026, 10, 25, tzinfo=UTC),
            room_groups=(with_views,),
        )
    )
    card.find.reset_mock()
    second = await offers("hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru")
    assert second.declared_rooms == ()
    assert second.declared_card is None
    card.find.assert_not_called()


@pytest.mark.asyncio
async def test_web_card_is_not_consulted_when_the_supplier_matched_the_hotel() -> None:
    from hotel_agent.application.ports.hotel_web_card import HotelCardLookupPort

    card = SimpleNamespace(find=AsyncMock(return_value=None))
    search = SimpleNamespace(
        search=AsyncMock(
            return_value=OfferLookup(offers=(), checked_at=datetime(2026, 10, 25, tzinfo=UTC))
        ),
        details=AsyncMock(return_value=None),
        aclose=AsyncMock(),
        source="Островок",
        sandbox=False,
    )
    result = await GetHotelOffers(
        repository(None),
        None,
        clock(),
        search_provider=cast(HotelOfferSearchPort, search),
        card_lookup=cast(HotelCardLookupPort, card),
    )("hotel-1", date(2026, 11, 1), date(2026, 11, 2), 2, "ru")

    assert result.status is OfferStatus.NO_OFFERS
    assert result.source == "Островок"
    card.find.assert_not_called()
