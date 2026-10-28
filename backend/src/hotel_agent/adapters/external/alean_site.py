import time
from urllib.parse import urlsplit

import httpx

from hotel_agent.adapters.external.alean_rooms import card_details, card_rooms
from hotel_agent.application.ports.supplier_details import SupplierHotel
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.domain.hotel_identity import HotelCandidate, HotelIdentity, assess_identity

HOSTS = frozenset({"alean.ru", "www.alean.ru"})
PATH_PREFIX = "/hotels/"
PAGE_LIMIT = 3
MAX_BYTES = 2_000_000
CACHE_SECONDS = 12 * 3600
HEADERS = {
    "User-Agent": "HotelAgent/0.1 (+https://github.com/GoatWhistle/o-hack; hotel room research)",
    "Accept": "text/html",
    "Accept-Language": "ru-RU,ru;q=0.9",
}


class AleanRoomCard:
    def __init__(
        self,
        research: WebResearchPort,
        client: httpx.AsyncClient | None = None,
        page_limit: int = PAGE_LIMIT,
    ) -> None:
        self._research = research
        self._client = client or httpx.AsyncClient(timeout=20, headers=HEADERS)
        self._owns_client = client is None
        self._page_limit = page_limit
        self._cache: dict[tuple[str, float, float], tuple[float, SupplierHotel | None]] = {}

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def find(self, hotel: HotelIdentity) -> SupplierHotel | None:
        key = (hotel.name, round(hotel.location[0], 4), round(hotel.location[1], 4))
        cached = self._cache.get(key)
        now = time.monotonic()
        if cached is not None and now - cached[0] < CACHE_SECONDS:
            return cached[1]
        found = await self._lookup(hotel)
        self._cache[key] = (now, found)
        return found

    async def _lookup(self, hotel: HotelIdentity) -> SupplierHotel | None:
        for url in await self._candidates(hotel):
            html = await self._page(url)
            if html is None:
                continue
            found = self._card(hotel, html, url)
            if found is not None:
                return found
        return None

    async def _candidates(self, hotel: HotelIdentity) -> tuple[str, ...]:
        try:
            hits = await self._research.search(query(hotel))
        except ValueError:
            return ()
        found = dict.fromkeys(hit.url for hit in hits if card_url(hit.url))
        return tuple(found)[: self._page_limit]

    async def _page(self, url: str) -> str | None:
        try:
            response = await self._client.get(url, follow_redirects=True)
        except httpx.HTTPError:
            return None
        if response.status_code != httpx.codes.OK or len(response.content) > MAX_BYTES:
            return None
        if not card_url(str(response.url)):
            return None
        return response.text

    def _card(self, hotel: HotelIdentity, html: str, url: str) -> SupplierHotel | None:
        details = card_details(html, url)
        if details is None or details.location is None:
            return None
        candidate = HotelCandidate(
            supplier_id=details.supplier_id,
            identity=HotelIdentity(
                name=details.name,
                address=details.address,
                location=details.location,
                city=hotel.city,
            ),
        )
        if not assess_identity(hotel, candidate).accepted:
            return None
        rooms = card_rooms(html)
        return SupplierHotel(details=details, rooms=rooms) if rooms else None


def query(hotel: HotelIdentity) -> str:
    parts = [f'"{hotel.name}"']
    if hotel.city:
        parts.append(hotel.city)
    parts.append("alean.ru номера вид из номера")
    return " ".join(parts)[:500]


def card_url(url: str) -> bool:
    parsed = urlsplit(url)
    return (
        parsed.scheme in {"http", "https"}
        and parsed.hostname in HOSTS
        and parsed.path.startswith(PATH_PREFIX)
        and parsed.path.count("/") >= 5
    )
