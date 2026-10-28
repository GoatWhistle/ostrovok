from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from hotel_agent.application.declared_rooms import DeclaredRoomsRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import (
    HotelOfferSearchPort,
    HotelOffersPort,
    OfferLookup,
    OfferProviderFailure,
    RoomOffer,
    SupplierRoom,
)
from hotel_agent.application.ports.hotel_web_card import HotelCardLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.supplier_details import SupplierDetails
from hotel_agent.application.use_cases.match_hotel_catalog import MatchHotelCatalog
from hotel_agent.domain.errors import HotelNotFound, InvalidQuery
from hotel_agent.domain.hotel_identity import HotelIdentity

CITY_RADIUS_M = 25_000


class OfferStatus(StrEnum):
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    HOTEL_UNMAPPED = "hotel_unmapped"
    PROVIDER_ERROR = "provider_error"
    NO_OFFERS = "no_offers"
    AVAILABLE = "available"


@dataclass(frozen=True, slots=True)
class HotelOffers:
    hotel_id: str
    check_in: date
    check_out: date
    adults: int
    status: OfferStatus
    source: str | None
    sandbox: bool
    checked_at: datetime | None
    offers: tuple[RoomOffer, ...]
    facilities: tuple[str, ...] = ()
    room_categories: tuple[str, ...] = ()
    photo_url: str | None = None
    room_groups: tuple[SupplierRoom, ...] = ()
    rates_complete: bool = False
    details: SupplierDetails | None = None
    declared_rooms: tuple[SupplierRoom, ...] = ()
    declared_card: str | None = None


class GetHotelOffers:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        provider: HotelOffersPort | None,
        clock: ClockPort,
        catalog_matcher: MatchHotelCatalog | None = None,
        *,
        search_provider: HotelOfferSearchPort | None = None,
        card_lookup: HotelCardLookupPort | None = None,
        room_card: HotelCardLookupPort | None = None,
    ) -> None:
        self._uow = uow
        self._provider = provider
        self._clock = clock
        self._catalog_matcher = catalog_matcher
        self._search_provider = search_provider
        self._card_lookup = card_lookup
        self._room_card = room_card

    @property
    def configured(self) -> bool:
        return self._provider is not None or self._search_provider is not None

    async def __call__(
        self, hotel_id: str, check_in: date, check_out: date, adults: int, residency: str
    ) -> HotelOffers:
        if check_out <= check_in or (check_out - check_in).days > 30:
            raise InvalidQuery("Check-out must follow check-in by at most 30 nights")
        today = self._clock.now().astimezone(ZoneInfo("Europe/Moscow")).date()
        if check_in < today or (check_in - today).days > 730:
            raise InvalidQuery("Check-in must be within the next 730 days")
        if adults < 1 or adults > 10 or len(residency) != 2 or not residency.isalpha():
            raise InvalidQuery("Invalid guest details")
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            city = hotel.city or await uow.search.nearby_city(hotel.location, CITY_RADIUS_M)
            supplier_id = (
                await uow.search.get_supplier_id(hotel_id, self._provider.supplier)
                if self._provider is not None
                else None
            )
        identity = HotelIdentity(
            name=hotel.name, address=hotel.address, location=hotel.location, city=city
        )
        content = None
        status = OfferStatus.HOTEL_UNMAPPED
        source = None
        checked_at = None
        offers: tuple[RoomOffer, ...] = ()
        if (
            self._provider is not None
            and self._provider.supplier == "nuitee"
            and supplier_id is None
            and self._catalog_matcher is not None
        ):
            match = await self._catalog_matcher(hotel_id, persist=True)
            supplier_id = match.supplier_id
            if match.status == "provider_error":
                return HotelOffers(
                    hotel_id=hotel_id,
                    check_in=check_in,
                    check_out=check_out,
                    adults=adults,
                    status=OfferStatus.PROVIDER_ERROR,
                    source=self._provider.source,
                    sandbox=self._provider.sandbox,
                    checked_at=None,
                    offers=(),
                )
        sandbox = self._provider.sandbox if self._provider is not None else False
        if self._provider is None and self._search_provider is not None:
            source = self._search_provider.source
            sandbox = self._search_provider.sandbox
            try:
                result = await self._search_provider.search(
                    identity,
                    check_in,
                    check_out,
                    adults,
                    residency.lower(),
                )
                if result is not None:
                    content = result
                    checked_at, offers = result.checked_at, result.offers
                    status = OfferStatus.AVAILABLE if offers else OfferStatus.NO_OFFERS
            except OfferProviderFailure:
                status = OfferStatus.PROVIDER_ERROR
        elif self._provider is None:
            status = OfferStatus.PROVIDER_UNAVAILABLE
        elif supplier_id is not None:
            source = self._provider.source
            try:
                result = await self._provider.fetch(
                    supplier_id, check_in, check_out, adults, residency.lower()
                )
            except OfferProviderFailure:
                status = OfferStatus.PROVIDER_ERROR
            else:
                checked_at = result.checked_at
                offers = result.offers
                status = OfferStatus.AVAILABLE if offers else OfferStatus.NO_OFFERS
        if status is OfferStatus.HOTEL_UNMAPPED and self._card_lookup is not None:
            found = await self._card_lookup.find(identity)
            if found is not None:
                content = OfferLookup(
                    offers=(),
                    checked_at=self._clock.now(),
                    room_groups=found.rooms,
                    details=found.details,
                )
                status = OfferStatus.NO_OFFERS
                source = found.details.supplier_id
                sandbox = False
                checked_at = content.checked_at
        declared, declared_card = await self._declared_rooms(identity, content)
        if declared and declared_card is not None:
            await self._save_declared(hotel_id, declared, declared_card)
        return HotelOffers(
            hotel_id=hotel_id,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            status=status,
            source=source,
            sandbox=sandbox,
            checked_at=checked_at,
            offers=offers,
            declared_rooms=declared,
            declared_card=declared_card,
            facilities=content.facilities if content else (),
            room_categories=content.room_categories if content else (),
            photo_url=content.photo_url if content else None,
            room_groups=content.room_groups if content else (),
            rates_complete=content.rates_complete if content else False,
            details=content.details if content else None,
        )

    async def _save_declared(
        self, hotel_id: str, rooms: tuple[SupplierRoom, ...], page_url: str
    ) -> None:
        source = urlsplit(page_url).hostname
        if source is None:
            return
        async with self._uow() as uow:
            await uow.search.save_declared_rooms(
                DeclaredRoomsRecord(
                    hotel_id=hotel_id, source=source, page_url=page_url, rooms=rooms
                )
            )
            await uow.commit()

    async def _declared_rooms(
        self, identity: HotelIdentity, content: OfferLookup | None
    ) -> tuple[tuple[SupplierRoom, ...], str | None]:
        if self._room_card is None or content is None:
            return (), None
        if any(room.views or room.floor is not None for room in content.room_groups):
            return (), None
        found = await self._room_card.find(identity)
        if found is None or not found.rooms:
            return (), None
        if found.details.page_url == (content.details.page_url if content.details else None):
            return (), None
        return found.rooms, found.details.page_url
