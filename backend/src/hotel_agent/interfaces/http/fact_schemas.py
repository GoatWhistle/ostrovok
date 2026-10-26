from collections.abc import Mapping
from datetime import datetime

from pydantic import BaseModel, Field

from hotel_agent.application.dto import ConflictRecord
from hotel_agent.domain.entities import Fact
from hotel_agent.interfaces.http.search_schemas import FactBriefSchema


class ProvenanceSchema(BaseModel):
    source_type: str
    source_ref: str | None = None
    source_url: str | None = None
    evidence: list[dict[str, str]] = Field(default_factory=list)
    method: str
    confidence: float
    observed_at: datetime | None = None
    computed_at: datetime
    valid_until: datetime | None = None


class ConflictSchema(BaseModel):
    id: str
    characteristic_key: str
    fact_ids: list[str]
    resolution: str
    winner_fact_id: str | None = None
    rule: str


class FactSchema(FactBriefSchema):
    subject: str
    qualifiers: dict[str, object]
    explanation: str
    provenance: ProvenanceSchema


class FactDetailSchema(FactSchema):
    history: list[FactSchema] = Field(default_factory=list)
    conflicts: list[ConflictSchema] = Field(default_factory=list)


def conflict_schema(record: ConflictRecord) -> ConflictSchema:
    return ConflictSchema(
        id=record.id,
        characteristic_key=record.characteristic_key,
        fact_ids=list(record.fact_ids),
        resolution=record.resolution,
        winner_fact_id=record.winner_fact_id,
        rule=record.rule,
    )


def fact_schema(fact: Fact) -> FactSchema:
    source_ref = fact.provenance.source.ref
    source_url = fact.provenance.source.url or (
        source_ref if source_ref and source_ref.startswith(("https://", "http://")) else None
    )
    quotes = fact.qualifiers.get("source_quotes", ())
    evidence = [{"kind": item.kind.value, "text": item.text} for item in fact.provenance.evidence]
    evidence += [
        {"kind": "quote", "text": str(quote)}
        for quote in (quotes if isinstance(quotes, list | tuple) else ())
    ]
    label = (
        str(fact.qualifiers.get("source_text"))
        if fact.qualifiers.get("source_text")
        else f"{fact.characteristic_key}: {fact.value} {fact.unit or ''}".strip()
    )
    return FactSchema(
        fact_id=str(fact.id),
        characteristic_key=fact.characteristic_key,
        value=dict(fact.value) if isinstance(fact.value, Mapping) else fact.value,
        unit=fact.unit,
        label=label,
        confidence=fact.confidence.value,
        source_type=fact.provenance.source_type,
        status=fact.status,
        geo_refs=[str(ref) for ref in fact.geo_refs],
        subject=str(fact.subject),
        qualifiers=dict(fact.qualifiers),
        explanation=fact.explanation,
        provenance=ProvenanceSchema(
            source_type=fact.provenance.source_type,
            source_ref=fact.provenance.source.ref,
            source_url=source_url,
            evidence=evidence,
            method=fact.provenance.method,
            confidence=fact.confidence.value,
            observed_at=fact.provenance.observed_at,
            computed_at=fact.provenance.computed_at,
            valid_until=fact.provenance.valid_until,
        ),
    )
