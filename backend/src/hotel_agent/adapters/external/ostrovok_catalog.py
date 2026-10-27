import re
from dataclasses import dataclass
from typing import Any

import httpx

MULTICOMPLETE = "https://ostrovok.ru/api/site/multicomplete.json"
OTA_ID = re.compile(r"[a-zA-Z0-9_-]+")
SLUG = re.compile(r"[a-z0-9_][a-z0-9_.-]*/[a-z0-9_][a-z0-9_.-]*")


@dataclass(frozen=True, slots=True, kw_only=True)
class CatalogSuggestion:
    master_id: int
    ota_id: str
    name: str
    address: str | None
    city: str | None
    region_id: int | None
    slug: str

    @property
    def page_url(self) -> str:
        return f"https://ostrovok.ru/hotel/{self.slug}/mid{self.master_id}/{self.ota_id}/"


def suggestions(payload: object, country: str = "RU") -> tuple[CatalogSuggestion, ...]:
    if not isinstance(payload, dict):
        raise TypeError("Invalid suggestion response")
    rows = payload.get("hotels")
    if rows is None:
        return ()
    if not isinstance(rows, list):
        raise TypeError("Invalid suggestion list")
    found: dict[int, CatalogSuggestion] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise TypeError("Invalid suggestion")
        if str(row.get("country_code") or "").upper() != country.upper():
            continue
        suggestion = _suggestion(row)
        if suggestion is not None:
            found.setdefault(suggestion.master_id, suggestion)
    return tuple(found.values())


def _suggestion(row: dict[str, Any]) -> CatalogSuggestion | None:
    master_id, ota_id, name = row.get("master_id"), row.get("otahotel_id"), row.get("hotel_name")
    slug, region = row.get("slug"), row.get("region_id")
    if isinstance(master_id, bool) or not isinstance(master_id, int) or master_id <= 0:
        return None
    if not isinstance(ota_id, str) or OTA_ID.fullmatch(ota_id) is None:
        return None
    if not isinstance(name, str) or not name.strip():
        return None
    if not isinstance(slug, str) or SLUG.fullmatch(slug) is None:
        return None
    address, city = row.get("hotel_address"), row.get("region_name")
    return CatalogSuggestion(
        master_id=master_id,
        ota_id=ota_id,
        name=name.strip(),
        address=address.strip() if isinstance(address, str) and address.strip() else None,
        city=city.strip() if isinstance(city, str) and city.strip() else None,
        region_id=region if isinstance(region, int) and not isinstance(region, bool) else None,
        slug=slug,
    )


class OstrovokCatalog:
    def __init__(self, client: httpx.AsyncClient, limit: int = 20) -> None:
        self._client = client
        self._limit = limit

    async def suggest(self, query: str) -> tuple[CatalogSuggestion, ...]:
        text = " ".join(query.split())
        if not text:
            return ()
        response = await self._client.get(
            MULTICOMPLETE,
            params={"query": text, "language": "ru", "limit": self._limit},
            headers={"Accept": "application/json"},
            timeout=20,
        )
        response.raise_for_status()
        return suggestions(response.json())
