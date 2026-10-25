from collections.abc import Mapping
from typing import Literal

from pydantic import BaseModel, Field

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.search_hotels import SearchOutcome, SearchResult
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.errors import UnknownCharacteristic
from hotel_agent.domain.services.scoring import PropertyMatch
from hotel_agent.interfaces.http.schemas import CameraSchema


class SearchRequestSchema(BaseModel):
    query: str
    region_id: str | None = "sochi"
    bbox: tuple[float, float, float, float] | None = None
    limit: int = Field(default=20, ge=1, le=100)
    cursor: str | None = None
    compute_missing: bool = True


class ParsedIntentSchema(BaseModel):
    characteristic_key: str
    op: str
    value: bool | float | str | None
    weight: float
    required: bool
    source_text: str


class QueryCorrectionSchema(BaseModel):
    original: str
    corrected: str
    reason: str


class ParsedSchema(BaseModel):
    intents: list[ParsedIntentSchema]
    unmatched_terms: list[str]
    location_hint: str | None = None
    normalized_query: str | None = None
    corrections: list[QueryCorrectionSchema] = Field(default_factory=list)
    unsupported_region: str | None = None
    needs_clarification: bool = False


class FactBriefSchema(BaseModel):
    fact_id: str
    characteristic_key: str
    value: bool | float | str | dict[str, object] | None
    unit: str | None = None
    label: str
    confidence: float
    source_type: str
    status: str
    geo_refs: list[str]


class MatchedPropertySchema(BaseModel):
    characteristic_key: str
    match: str
    label: str
    explanation: str | None = None
    fact: FactBriefSchema | None = None
    geo_refs: list[str] = Field(default_factory=list)
    camera: CameraSchema | None = None


class HotelSummarySchema(BaseModel):
    id: str
    name: str
    address: str | None = None
    location: tuple[float, float]
    stars: int | None = None
    building_id: str | None = None
    height_m: float | None = None
    levels: int | None = None


class BuildingFeatureSchema(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: dict[str, object]
    properties: dict[str, object]


class SearchResultSchema(BaseModel):
    hotel: HotelSummarySchema
    score: float
    matched: list[MatchedPropertySchema]
    camera: CameraSchema
    footprint: BuildingFeatureSchema | None = None


class ViewportSchema(BaseModel):
    bbox: tuple[float, float, float, float]
    camera: CameraSchema


class SearchResponseSchema(BaseModel):
    query_id: str
    parsed: ParsedSchema
    results: list[SearchResultSchema]
    viewport: ViewportSchema | None = None
    pending: list[dict[str, str]] = Field(default_factory=list)
    next_cursor: str | None = None
    took_ms: int


def search_schema(
    outcome: SearchOutcome, registry: CharacteristicRegistryPort, took_ms: int
) -> SearchResponseSchema:
    parsed = ParsedSchema(
        intents=[
            ParsedIntentSchema(
                characteristic_key=item.characteristic_key,
                op=item.op,
                value=item.value,
                weight=item.weight,
                required=item.required,
                source_text=item.source_text,
            )
            for item in outcome.parsed.intents
        ],
        unmatched_terms=list(outcome.parsed.unmatched_terms),
        location_hint=outcome.parsed.location_hint,
        normalized_query=outcome.parsed.normalized_query,
        corrections=[
            QueryCorrectionSchema(
                original=item.original,
                corrected=item.corrected,
                reason=item.reason,
            )
            for item in outcome.parsed.corrections
        ],
        unsupported_region=outcome.parsed.unsupported_region,
        needs_clarification=outcome.parsed.needs_clarification,
    )
    results = [_search_result(item, registry) for item in outcome.results]
    viewport = None
    if results:
        points = [item.hotel.location for item in results]
        bbox = (
            min(point[0] for point in points),
            min(point[1] for point in points),
            max(point[0] for point in points),
            max(point[1] for point in points),
        )
        viewport = ViewportSchema(bbox=bbox, camera=results[0].camera)
    return SearchResponseSchema(
        query_id=outcome.query_id,
        parsed=parsed,
        results=results,
        viewport=viewport,
        took_ms=took_ms,
    )


def _search_result(
    result: SearchResult, registry: CharacteristicRegistryPort
) -> SearchResultSchema:
    hotel = result.hotel
    best_facade = next(
        (match.fact for match in result.scored.matches if match.fact and match.fact.subject.part),
        None,
    )
    bearing = (
        (float(best_facade.subject.part) + 180) % 360
        if best_facade and best_facade.subject.part is not None
        else 0
    )
    facade_id = (
        str(best_facade.geo_refs[0]).removeprefix("g_")
        if best_facade and best_facade.geo_refs
        else None
    )
    camera = CameraSchema(
        center=hotel.location,
        zoom=17,
        pitch=60,
        bearing=bearing,
        focus_facade_id=facade_id,
    )
    footprint = None
    if hotel.building_id and hotel.footprint:
        footprint = BuildingFeatureSchema(
            id=hotel.building_id,
            geometry=hotel.footprint,
            properties={
                "building_id": hotel.building_id,
                "hotel_id": hotel.id,
                "is_hotel": True,
                "height_m": hotel.height_m,
                "min_height_m": 0,
                "levels": hotel.levels,
                "height_fact_id": f"f_height_{hotel.id}",
            },
        )
    return SearchResultSchema(
        hotel=HotelSummarySchema(
            id=hotel.id,
            name=hotel.name,
            address=hotel.address,
            location=hotel.location,
            stars=hotel.stars,
            building_id=hotel.building_id,
            height_m=hotel.height_m,
            levels=hotel.levels,
        ),
        score=round(result.scored.score, 3),
        matched=[_matched_schema(match, registry, camera) for match in result.scored.matches],
        camera=camera,
        footprint=footprint,
    )


def _matched_schema(
    match: PropertyMatch, registry: CharacteristicRegistryPort, camera: CameraSchema
) -> MatchedPropertySchema:
    try:
        characteristic = registry.get(match.intent.characteristic_key)
        title = characteristic.title_ru
    except UnknownCharacteristic:
        title = match.intent.source_text
    fact = match.fact
    label = title
    brief = None
    if fact is not None:
        label = (
            f"{label}: {fact.value}"
            if match.intent.characteristic_key.startswith("nearby:")
            else f"{label}: {fact.value} {fact.unit or ''}".strip()
        )
        brief = _brief(fact, label)
    return MatchedPropertySchema(
        characteristic_key=match.intent.characteristic_key,
        match=match.quality,
        label=label,
        explanation=fact.explanation if fact else "Нет подтверждённого факта",
        fact=brief,
        geo_refs=[str(ref) for ref in fact.geo_refs] if fact else [],
        camera=camera if fact and fact.subject.part else None,
    )


def _brief(fact: Fact, label: str) -> FactBriefSchema:
    return FactBriefSchema(
        fact_id=str(fact.id),
        characteristic_key=fact.characteristic_key,
        value=dict(fact.value) if isinstance(fact.value, Mapping) else fact.value,
        unit=fact.unit,
        label=label,
        confidence=fact.confidence.value,
        source_type=fact.provenance.source_type,
        status=fact.status,
        geo_refs=[str(ref) for ref in fact.geo_refs],
    )
