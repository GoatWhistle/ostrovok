import asyncio
from datetime import date, timedelta

import httpx

from hotel_agent.adapters.external.ostrovok_rates import site_candidate, site_offers
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
        self._cache: dict[SearchKey, OfferLookup] = {}
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
        if saved and self._clock.now() - saved.checked_at < timedelta(minutes=10):
            return saved
        task = self._pending.get(key)
        if task is None:
            task = asyncio.create_task(self._lookup(key))
            self._pending[key] = task
            task.add_done_callback(lambda finished: self._pending.pop(key, None))
        return await asyncio.shield(task)

    async def _lookup(self, key: SearchKey) -> OfferLookup | None:
        hotel, check_in, check_out, adults, _ = key
        try:
            async with asyncio.timeout(40), self._limit:
                rows = await self._site.search(hotel, check_in, check_out, adults)
                accepted = [
                    row for row in rows if assess_identity(hotel, site_candidate(row)).accepted
                ]
                if len(accepted) != 1:
                    return None
                result = OfferLookup(site_offers(accepted[0]), self._clock.now())
        except (TimeoutError, KeyError, TypeError, ValueError) as error:
            raise OfferProviderFailure("Ostrovok website lookup failed") from error
        if len(self._cache) >= 128:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = result
        return result
