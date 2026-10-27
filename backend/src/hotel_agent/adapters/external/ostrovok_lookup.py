import asyncio
import re
from dataclasses import dataclass
from difflib import SequenceMatcher

import httpx

from hotel_agent.adapters.external.ostrovok_catalog import CatalogSuggestion, OstrovokCatalog
from hotel_agent.adapters.external.ostrovok_page import details
from hotel_agent.adapters.external.ostrovok_rooms import page_hotel, room_groups
from hotel_agent.application.ports.hotel_offers import OfferProviderFailure, SupplierRoom
from hotel_agent.application.ports.supplier_details import SupplierDetails
from hotel_agent.domain.hotel_identity import (
    HotelCandidate,
    HotelIdentity,
    assess_identity,
    distance_m,
    name_parts,
)
from hotel_agent.domain.place_names import (
    ADDRESS_WORDS,
    address_status,
    house_numbers,
    name_key,
    street_parts,
    tokens,
)

PAGE_HEADERS = {"Accept": "text/html", "Accept-Language": "ru-RU,ru;q=0.9"}
NOISE = re.compile(r"[\"«»()\[\]]+")
CANDIDATE_LIMIT = 5
SAME_BUILDING_M = 100
NAME_RATIO = 0.7


@dataclass(frozen=True, slots=True, kw_only=True)
class ResolvedHotel:
    suggestion: CatalogSuggestion
    details: SupplierDetails
    rooms: tuple[SupplierRoom, ...]


def search_queries(hotel: HotelIdentity) -> tuple[str, ...]:
    name = " ".join(NOISE.sub(" ", hotel.name).split())
    if not name:
        return ()
    found = [name]
    street = " ".join(
        token for token in (hotel.address or "").split() if not any(c.isdigit() for c in token)
    ).strip()
    if street:
        found.insert(0, f"{name} {street}")
    if hotel.city:
        found.insert(1 if street else 0, f"{name} {hotel.city}")
    return tuple(dict.fromkeys(found))


def address_parts(value: str | None) -> tuple[frozenset[str], frozenset[str]]:
    parts = [token for token in tokens(value or "") if token not in ADDRESS_WORDS]
    return street_parts(parts), house_numbers(parts)


def rank_suggestions(
    hotel: HotelIdentity, found: tuple[CatalogSuggestion, ...]
) -> tuple[CatalogSuggestion, ...]:
    local_name = name_parts(hotel.name)
    local_key = name_key(hotel.name)
    local_street, local_house = address_parts(hotel.address)
    city = frozenset(tokens(hotel.city or ""))
    scored = []
    for suggestion in found:
        street, house = address_parts(suggestion.address)
        shared_name = local_name & name_parts(suggestion.name)
        same_street = bool(local_street) and local_street <= street
        same_house = bool(local_house) and bool(local_house & house)
        same_city = bool(city) and bool(city & frozenset(tokens(suggestion.city or "")))
        similarity = SequenceMatcher(None, local_key, name_key(suggestion.name)).ratio()
        if not shared_name and not same_street and similarity < NAME_RATIO:
            continue
        score = (
            2 * (same_street and same_house)
            + same_street
            + same_city
            + len(shared_name) / 10
            + similarity / 10
        )
        scored.append((score, suggestion))
    scored.sort(key=lambda row: row[0], reverse=True)
    return tuple(suggestion for _, suggestion in scored[:CANDIDATE_LIMIT])


def one_hotel(hotel: HotelIdentity, accepted: list[ResolvedHotel]) -> ResolvedHotel | None:
    if not accepted:
        return None
    if len({name_key(found.details.name) for found in accepted}) > 1:
        return None
    if len({address_status(hotel.address, found.details.address) for found in accepted}) > 1:
        return None

    def gap(found: ResolvedHotel) -> float:
        remote = found.details.location
        return distance_m(hotel.location, remote) if remote is not None else float("inf")

    best = min(accepted, key=gap)
    anchor = best.details.location
    if anchor is None:
        return None
    apart = (
        distance_m(anchor, found.details.location)
        for found in accepted
        if found.details.location is not None
    )
    return best if max(apart) <= SAME_BUILDING_M else None


class OstrovokLookup:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._catalog = OstrovokCatalog(client)

    async def resolve(self, hotel: HotelIdentity) -> ResolvedHotel | None:
        queries = search_queries(hotel)
        results = await asyncio.gather(
            *(self._catalog.suggest(query) for query in queries), return_exceptions=True
        )
        found: dict[int, CatalogSuggestion] = {}
        failures = 0
        for result in results:
            if isinstance(result, BaseException):
                failures += 1
                continue
            for suggestion in result:
                found.setdefault(suggestion.master_id, suggestion)
        if failures == len(queries) and queries:
            raise OfferProviderFailure("Ostrovok catalogue is unavailable")
        ranked = rank_suggestions(hotel, tuple(found.values()))
        if not ranked:
            return None
        return one_hotel(hotel, await self._verify(hotel, ranked))

    async def _verify(
        self, hotel: HotelIdentity, ranked: tuple[CatalogSuggestion, ...]
    ) -> list[ResolvedHotel]:
        pages = await asyncio.gather(
            *(self._read(suggestion) for suggestion in ranked), return_exceptions=True
        )
        accepted = []
        for resolved in pages:
            if not isinstance(resolved, ResolvedHotel) or resolved.details.location is None:
                continue
            candidate = HotelCandidate(
                supplier_id=str(resolved.suggestion.master_id),
                identity=HotelIdentity(
                    name=resolved.details.name,
                    address=resolved.details.address,
                    location=resolved.details.location,
                    city=resolved.details.city,
                ),
            )
            if assess_identity(hotel, candidate).accepted:
                accepted.append(resolved)
        return accepted

    async def _read(self, suggestion: CatalogSuggestion) -> ResolvedHotel:
        response = await self._client.get(
            suggestion.page_url, headers=PAGE_HEADERS, timeout=25, follow_redirects=True
        )
        response.raise_for_status()
        hotel = page_hotel(response.text, suggestion.ota_id, suggestion.master_id)
        try:
            rooms = room_groups(hotel)
        except (KeyError, TypeError, ValueError):
            rooms = ()
        return ResolvedHotel(
            suggestion=suggestion,
            details=details(hotel, suggestion.page_url, str(suggestion.master_id)),
            rooms=rooms,
        )
