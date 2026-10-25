import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.errors import InvalidQuery
from hotel_agent.domain.query import Intent, NearbyObjectRequest, ParsedQuery
from hotel_agent.domain.services.scoring import Scored, score


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchResult:
    hotel: SearchHotelRecord
    scored: Scored


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchOutcome:
    query_id: str
    parsed: ParsedQuery
    results: Sequence[SearchResult]


class SearchHotels:
    def __init__(self, llm: LLMPort, uow: UnitOfWorkFactory, clock: ClockPort) -> None:
        self._llm = llm
        self._uow = uow
        self._clock = clock

    async def __call__(
        self,
        query: str,
        region: str,
        bbox: tuple[float, float, float, float] | None,
        limit: int,
    ) -> SearchOutcome:
        if not query.strip():
            raise InvalidQuery("Search query is empty")
        parsed = await self._llm.parse_query(query)
        if parsed.nearby_objects:
            parsed = replace(
                parsed,
                intents=parsed.intents
                + tuple(_nearby_intent(request) for request in parsed.nearby_objects),
            )
        async with self._uow() as uow:
            regions = await uow.regions.list_loaded()
            selected_region = next((item for item in regions if item.id == region), None)
            location = parsed.location_hint
            if (
                location
                and selected_region
                and location.casefold().strip()
                not in {
                    selected_region.id.casefold(),
                    selected_region.name.casefold(),
                }
            ):
                parsed = replace(parsed, unsupported_region=location, needs_clarification=False)
                return SearchOutcome(
                    query_id=hashlib.sha256(f"{query}\x00{region}\x00{bbox}".encode()).hexdigest()[
                        :16
                    ],
                    parsed=parsed,
                    results=(),
                )
            if parsed.needs_clarification:
                fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
                return SearchOutcome(
                    query_id=hashlib.sha256(fingerprint).hexdigest()[:16],
                    parsed=parsed,
                    results=(),
                )
            hotels = await uow.search.list_hotels(region, bbox)
            stored = await uow.search.list_facts(region)
            nearby = [
                (request, await uow.nearby_objects.list_matches(region, request))
                for request in parsed.nearby_objects
            ]
        facts = _best_facts(stored)
        now = self._clock.now()
        if nearby:
            for request, matches in nearby:
                key = _nearby_key(request)
                for hotel in hotels:
                    ids = matches.get(hotel.id, ())
                    facts.setdefault(hotel.id, {})[key] = fact_from_record(
                        _nearby_record(hotel.id, key, request, ids, now)
                    )
        ranked = [
            SearchResult(hotel=hotel, scored=score(parsed.intents, facts.get(hotel.id, {}), now))
            for hotel in hotels
        ]
        if parsed.intents:
            ranked = [
                item for item in ranked if item.scored.score > 0 and not item.scored.disqualified
            ]
            ranked.sort(key=lambda item: (-item.scored.score, item.hotel.id))
        else:
            ranked.sort(
                key=lambda item: (item.hotel.name == item.hotel.id, item.hotel.name.casefold())
            )
        fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
        return SearchOutcome(
            query_id=hashlib.sha256(fingerprint).hexdigest()[:16],
            parsed=parsed,
            results=ranked[:limit],
        )


def _best_facts(rows: Sequence[SearchFactRecord]) -> dict[str, dict[str, Fact]]:
    grouped: dict[str, dict[str, Fact]] = {}
    for row in rows:
        current = grouped.setdefault(row.hotel_id, {})
        fact = fact_from_record(row)
        old = current.get(row.characteristic_key)
        if old is None or (
            row.characteristic_key == "noise_level"
            and isinstance(fact.value, int | float)
            and isinstance(old.value, int | float)
            and fact.value < old.value
        ):
            current[row.characteristic_key] = fact
    return grouped


def _nearby_key(request: NearbyObjectRequest) -> str:
    return (
        f"nearby:{request.osm_key}:{request.osm_value}:{int(request.open_24h)}:{request.radius_m}"
    )


def _nearby_intent(request: NearbyObjectRequest) -> Intent:
    return Intent(
        characteristic_key=_nearby_key(request),
        op=Op.GTE,
        value=1.0,
        weight=1.0,
        required=False,
        source_text=request.source_text,
    )


def _nearby_record(
    hotel_id: str,
    key: str,
    request: NearbyObjectRequest,
    ids: Sequence[str],
    now: datetime,
) -> SearchFactRecord:
    digest = hashlib.sha256(key.encode()).hexdigest()[:10]
    return SearchFactRecord(
        hotel_id=hotel_id,
        id=f"f_near_{hotel_id}_{digest}",
        characteristic_key=key,
        value=len(ids),
        unit="count",
        qualifiers={},
        source_type="computed",
        source_id=None,
        method="nearby_objects@1",
        confidence=0.7,
        computed_at=now,
        valid_until=now + timedelta(days=30),
        status="active",
        geo_refs=tuple(f"g_poi_{item}" for item in ids),
        explanation=(
            f"Объекты OpenStreetMap в радиусе {request.radius_m} м"
            + (" с тегом opening_hours=24/7" if request.open_24h else "")
        ),
        facade_azimuth=None,
    )
