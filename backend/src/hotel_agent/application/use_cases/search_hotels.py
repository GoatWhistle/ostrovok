import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.facility_matching import facility_fact, facility_intent
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
        if parsed.nearby_objects or parsed.facility_requests:
            parsed = replace(
                parsed,
                intents=parsed.intents
                + tuple(_nearby_intent(request) for request in parsed.nearby_objects)
                + tuple(facility_intent(request) for request in parsed.facility_requests),
            )
        location = parsed.location_hint.strip() if parsed.location_hint else None
        if location and location.casefold() in {"россия", "russia"}:
            location = None
        if parsed.needs_clarification or not location:
            parsed = replace(parsed, location_hint=location, needs_clarification=True)
            return _empty(query, region, bbox, parsed)
        async with self._uow() as uow:
            if location.casefold() in {"сочи", "sochi", "адлер", "adler"}:
                region = "sochi"
            else:
                region = "russia"
                city_bbox = await uow.regions.city_bbox(location)
                if city_bbox is None:
                    parsed = replace(parsed, unsupported_region=location)
                    return _empty(query, region, bbox, parsed)
                if bbox is not None:
                    overlap = _intersection(bbox, city_bbox)
                    if overlap is None:
                        return _empty(query, region, bbox, parsed)
                    bbox = overlap
                else:
                    bbox = city_bbox
            hotels = await uow.search.list_hotels(region, bbox)
            stored = await uow.search.list_facts(region)
            nearby = [
                (request, await uow.nearby_objects.list_matches(region, request, bbox))
                for request in parsed.nearby_objects
            ]
            supplier_content = (
                await uow.search.list_supplier_content(region) if parsed.facility_requests else ()
            )
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
        for facility_request in parsed.facility_requests:
            for content in supplier_content:
                record = facility_fact(facility_request, content)
                if record is not None:
                    facts.setdefault(content.hotel_id, {})[record.characteristic_key] = (
                        fact_from_record(record)
                    )
        ranked = [
            SearchResult(hotel=hotel, scored=score(parsed.intents, facts.get(hotel.id, {}), now))
            for hotel in hotels
        ]
        if parsed.intents:
            ranked = [item for item in ranked if not item.scored.disqualified]
            ranked.sort(
                key=lambda item: (
                    -item.scored.score,
                    item.hotel.name == item.hotel.id,
                    item.hotel.name.casefold(),
                )
            )
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


def _empty(
    query: str,
    region: str,
    bbox: tuple[float, float, float, float] | None,
    parsed: ParsedQuery,
) -> SearchOutcome:
    fingerprint = f"{query}\x00{region}\x00{bbox}".encode()
    return SearchOutcome(
        query_id=hashlib.sha256(fingerprint).hexdigest()[:16], parsed=parsed, results=()
    )


def _intersection(
    first: tuple[float, float, float, float], second: tuple[float, float, float, float]
) -> tuple[float, float, float, float] | None:
    west, south = max(first[0], second[0]), max(first[1], second[1])
    east, north = min(first[2], second[2]), min(first[3], second[3])
    return (west, south, east, north) if west <= east and south <= north else None


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
