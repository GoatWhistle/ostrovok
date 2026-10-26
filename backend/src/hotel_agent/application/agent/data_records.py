from dataclasses import dataclass
from typing import Any

from hotel_agent.application.agent.wish_records import WishResult
from hotel_agent.application.dto import GeoFeatureRecord, SearchFactRecord, SearchHotelRecord
from hotel_agent.domain.query import Intent


@dataclass(frozen=True, slots=True, kw_only=True)
class DataCheck:
    field: str
    op: str
    value: float


@dataclass(frozen=True, slots=True, kw_only=True)
class DataCriterion:
    term: str
    source_text: str
    checks: tuple[DataCheck, ...]
    required: bool
    explanation: str


@dataclass(frozen=True, slots=True, kw_only=True)
class DataStep:
    action: str
    arguments: dict[str, Any]
    criteria: tuple[DataCriterion, ...] = ()
    question: str | None = None
    reason: str = ""
    irrelevant_sources: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True, kw_only=True)
class ExplorationOutcome:
    hotels: tuple[SearchHotelRecord, ...]
    intents: tuple[Intent, ...] = ()
    facts: tuple[SearchFactRecord, ...] = ()
    resolved_terms: tuple[str, ...] = ()
    bbox: tuple[float, float, float, float] | None = None
    question: str | None = None
    features: tuple[GeoFeatureRecord, ...] = ()
    wish_results: tuple[WishResult, ...] = ()
    processed_terms: tuple[str, ...] = ()
