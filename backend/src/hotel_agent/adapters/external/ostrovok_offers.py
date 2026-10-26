import asyncio
from datetime import date, datetime, timedelta

import httpx

from hotel_agent.adapters.external.ostrovok_content import site_content
from hotel_agent.adapters.external.ostrovok_rates import site_candidate
from hotel_agent.adapters.external.ostrovok_site import OstrovokSite
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.hotel_offers import OfferLookup, OfferProviderFailure
from hotel_agent.domain.hotel_identity import HotelIdentity, assess_identity

type SearchKey = tuple[HotelIdentity, date, date, int, str]


class OstrovokHotelOffers:
    source = "Островок"
    sandbox = False

    def __init__(self, clock: ClockPort, client: httpx.AsyncClient | None = None) -> None:
        self._clock = clock
        self._site = OstrovokSite(client)
        self._cache: dict[SearchKey, tuple[datetime, OfferLookup | None]] = {}
        self._pending: dict[SearchKey, asyncio.Task[OfferLookup | None]] = {}
        self._limit = asyncio.Semaphore(2)

    async def aclose(self) -> None:
        tasks = tuple(self._pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self._site.aclose()

    async def search(
        self, hotel: HotelIdentity, check_in: date, check_out: date, adults: int, residency: str
    ) -> OfferLookup | None:
        if hotel.country.upper() != "RU" or residency != "ru":
            raise OfferProviderFailure("Ostrovok website lookup supports Russian residency only")
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

    def _finished(self, key: SearchKey, task: asyncio.Task[OfferLookup | None]) -> None:
        self._pending.pop(key, None)
        if not task.cancelled():
            task.exception()

    async def _lookup(self, key: SearchKey) -> OfferLookup | None:
        hotel, check_in, check_out, adults, _ = key
        try:
            async with self._limit, asyncio.timeout(65):
                rows = await self._site.search(hotel, check_in, check_out, adults)
                accepted = [
                    row for row in rows if assess_identity(hotel, site_candidate(row)).accepted
                ]
                result = (
                    site_content(accepted[0], self._clock.now()) if len(accepted) == 1 else None
                )
                if result is not None:
                    result = await self._site.enrich(
                        accepted[0], result, check_in, check_out, adults
                    )
        except (TimeoutError, KeyError, TypeError, ValueError) as error:
            raise OfferProviderFailure("Ostrovok website lookup failed") from error
        if len(self._cache) >= 128:
            self._cache.pop(next(iter(self._cache)))
        ttl = timedelta(minutes=10) if result is not None else timedelta(minutes=1)
        self._cache[key] = (self._clock.now() + ttl, result)
        return result
