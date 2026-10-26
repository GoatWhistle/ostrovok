import httpx

from hotel_agent.adapters.external.nuitee_identity import hotel_identity
from hotel_agent.application.ports.hotel_discovery import (
    CatalogProviderFailure,
    DiscoveryResult,
)
from hotel_agent.domain.hotel_identity import HotelCandidate, HotelIdentity

URL = "https://api.liteapi.travel/v3.0/data/hotels"


class NuiteeDiscovery:
    def __init__(
        self,
        api_key: str,
        client: httpx.AsyncClient | None = None,
        *,
        page_size: int = 200,
        max_pages: int = 5,
    ) -> None:
        if not 1 <= page_size <= 5000 or not 1 <= max_pages <= 20:
            raise ValueError("Invalid catalog pagination limits")
        self._api_key = api_key
        self._client = client
        self._page_size = page_size
        self._max_pages = max_pages

    async def nearby(self, location: tuple[float, float]) -> DiscoveryResult:
        HotelIdentity(name="lookup", address=None, location=location)
        if self._client is not None:
            return await self._search(self._client, location)
        async with httpx.AsyncClient(timeout=20) as client:
            return await self._search(client, location)

    async def _search(
        self, client: httpx.AsyncClient, location: tuple[float, float]
    ) -> DiscoveryResult:
        candidates: dict[str, HotelCandidate] = {}
        for page in range(self._max_pages):
            try:
                response = await client.get(
                    URL,
                    headers={"X-API-Key": self._api_key},
                    params={
                        "countryCode": "RU",
                        "longitude": location[0],
                        "latitude": location[1],
                        "radius": 1000,
                        "limit": self._page_size,
                        "offset": page * self._page_size,
                        "language": "ru",
                    },
                )
                response.raise_for_status()
                body = response.json()
                if (
                    not isinstance(body, dict)
                    or body.get("error")
                    or not isinstance(body.get("data"), list)
                ):
                    raise ValueError("Invalid hotel list response")
                rows = body["data"]
                if len(rows) > self._page_size:
                    raise ValueError("Hotel page exceeds requested limit")
                added = 0
                for row in rows:
                    if (
                        not isinstance(row, dict)
                        or not isinstance(row.get("id"), str)
                        or not row["id"]
                    ):
                        raise ValueError("Invalid hotel identifier")
                    candidate = HotelCandidate(supplier_id=row["id"], identity=hotel_identity(row))
                    previous = candidates.get(candidate.supplier_id)
                    if previous is not None and previous != candidate:
                        raise ValueError("Inconsistent duplicate hotel")
                    added += int(previous is None)
                    candidates[candidate.supplier_id] = candidate
                total = body.get("total")
                if total is not None and (
                    isinstance(total, bool) or not isinstance(total, int) or total < len(candidates)
                ):
                    raise ValueError("Invalid hotel total")
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
                raise CatalogProviderFailure("Nuitee catalog lookup failed") from error
            complete = (
                len(candidates) >= total if isinstance(total, int) else len(rows) < self._page_size
            )
            if complete:
                return DiscoveryResult(tuple(candidates.values()), True)
            if added == 0:
                break
        return DiscoveryResult(tuple(candidates.values()), False)
