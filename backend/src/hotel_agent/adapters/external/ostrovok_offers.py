import asyncio
from datetime import date, datetime, timedelta

import httpx

from hotel_agent.adapters.external.ostrovok_lookup import ResolvedHotel
from hotel_agent.adapters.external.ostrovok_site import OstrovokSite
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import (
    OfferLookup,
    OfferProviderFailure,
    RoomOffer,
)
from hotel_agent.application.ports.supplier_details import SupplierHotel
from hotel_agent.domain.hotel_identity import HotelIdentity

type SearchKey = tuple[HotelIdentity, date, date, int, str]
type ResolveKey = tuple[HotelIdentity, str]


class OstrovokHotelOffers:
    source = "Островок"
    sandbox = False

    def __init__(self, clock: ClockPort, client: httpx.AsyncClient | None = None) -> None:
        self._clock = clock
        self._site = OstrovokSite(client)
        self._cache: dict[SearchKey, tuple[datetime, OfferLookup | None]] = {}
        self._resolved: dict[ResolveKey, tuple[datetime, ResolvedHotel | None]] = {}
        self._pending: dict[SearchKey, asyncio.Task[OfferLookup | None]] = {}
        self._limit = asyncio.Semaphore(2)

    async def aclose(self) -> None:
        tasks = tuple(self._pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self._site.aclose()

    async def details(self, hotel: HotelIdentity, residency: str = "ru") -> SupplierHotel | None:
        resolved = await self._resolve(hotel, residency)
        if resolved is None:
            return None
        return SupplierHotel(details=resolved.details, rooms=resolved.rooms)

    async def _resolve(self, hotel: HotelIdentity, residency: str) -> ResolvedHotel | None:
        self._supported(hotel, residency)
        key = (hotel, residency)
        saved = self._resolved.get(key)
        if saved and self._clock.now() < saved[0]:
            return saved[1]
        async with self._limit, asyncio.timeout(70):
            resolved = await self._site.resolve(hotel)
        ttl = timedelta(hours=12) if resolved is not None else timedelta(minutes=5)
        if len(self._resolved) >= 256:
            self._resolved.pop(next(iter(self._resolved)))
        self._resolved[key] = (self._clock.now() + ttl, resolved)
        return resolved

    async def search(
        self, hotel: HotelIdentity, check_in: date, check_out: date, adults: int, residency: str
    ) -> OfferLookup | None:
        self._supported(hotel, residency)
        key = (hotel, check_in, check_out, adults, residency)
        saved = self._cache.get(key)
        if saved and self._clock.now() < saved[0]:
            return saved[1]
        task = self._pending.get(key)
        if task is None:
            task = asyncio.create_task(self._lookup(key))
            self._pending[key] = task
            task.add_done_callback(lambda finished: self._finished(key, finished))
        return await asyncio.shield(task)

    def _supported(self, hotel: HotelIdentity, residency: str) -> None:
        if hotel.country.upper() != "RU" or residency != "ru":
            raise OfferProviderFailure("Ostrovok website lookup supports Russian residency only")

    def _finished(self, key: SearchKey, task: asyncio.Task[OfferLookup | None]) -> None:
        self._pending.pop(key, None)
        if not task.cancelled():
            task.exception()

    async def _lookup(self, key: SearchKey) -> OfferLookup | None:
        hotel, check_in, check_out, adults, residency = key
        try:
            resolved = await self._resolve(hotel, residency)
            result = None
            if resolved is not None:
                result = await self._content(resolved, check_in, check_out, adults)
        except (TimeoutError, KeyError, TypeError, ValueError) as error:
            raise OfferProviderFailure("Ostrovok website lookup failed") from error
        if len(self._cache) >= 128:
            self._cache.pop(next(iter(self._cache)))
        ttl = timedelta(minutes=10) if result is not None else timedelta(minutes=1)
        self._cache[key] = (self._clock.now() + ttl, result)
        return result

    async def _content(
        self, resolved: ResolvedHotel, check_in: date, check_out: date, adults: int
    ) -> OfferLookup:
        details = resolved.details
        offers: tuple[RoomOffer, ...] = ()
        complete = False
        try:
            async with self._limit, asyncio.timeout(40):
                offers = await self._site.offers(resolved, check_in, check_out, adults)
            complete = True
        except (OfferProviderFailure, TimeoutError):
            offers = ()
        return OfferLookup(
            offers=offers,
            checked_at=self._clock.now(),
            facilities=details.facilities,
            room_categories=tuple(dict.fromkeys(room.name for room in resolved.rooms)),
            photo_url=details.photos[0].url if details.photos else None,
            room_groups=resolved.rooms,
            rates_complete=complete,
            details=details,
        )
