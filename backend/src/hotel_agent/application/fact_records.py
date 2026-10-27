from collections.abc import Mapping
from dataclasses import dataclass
from typing import cast

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.entities import Fact, FactStatus, FactValue
from hotel_agent.domain.value_objects import (
    Azimuth,
    Confidence,
    Evidence,
    EvidenceKind,
    FactId,
    GeoFeatureId,
    HotelId,
    Provenance,
    SourceRef,
    Subject,
)

EVIDENCE_KINDS = frozenset(kind.value for kind in EvidenceKind)


@dataclass(frozen=True, slots=True, kw_only=True)
class FactOwner:
    hotel_id: str
    subject_type: str
    subject_id: str
    facade_azimuth: float | None = None

    @classmethod
    def hotel(cls, hotel_id: str) -> "FactOwner":
        return cls(hotel_id=hotel_id, subject_type="hotel", subject_id=hotel_id)

    @classmethod
    def of(cls, record: SearchFactRecord) -> "FactOwner":
        return cls(
            hotel_id=record.hotel_id,
            subject_type="facade" if record.facade_azimuth is not None else "hotel",
            subject_id=record.subject_id or record.hotel_id,
            facade_azimuth=record.facade_azimuth,
        )


def fact_from_record(row: SearchFactRecord) -> Fact:
    subject = (
        Subject.facade(HotelId(row.hotel_id), Azimuth(row.facade_azimuth))
        if row.facade_azimuth is not None
        else Subject.hotel(HotelId(row.hotel_id))
    )
    qualifiers = dict(row.qualifiers)
    if row.facade_azimuth is not None:
        qualifiers["facade_azimuth"] = row.facade_azimuth
    return Fact(
        id=FactId(row.id),
        subject=subject,
        characteristic_key=row.characteristic_key,
        value=cast(FactValue, row.value),
        unit=row.unit,
        qualifiers=qualifiers,
        provenance=Provenance(
            source=SourceRef(
                source_type=SourceType(row.source_type), ref=row.source_id, url=row.source_url
            ),
            method=row.method,
            confidence=Confidence(row.confidence),
            computed_at=row.computed_at,
            observed_at=row.observed_at,
            valid_until=row.valid_until,
            evidence=tuple(
                Evidence(kind=EvidenceKind(kind), text=text)
                for kind, text in row.evidence
                if kind in EVIDENCE_KINDS
            ),
        ),
        status=FactStatus(row.status),
        geo_refs=tuple(GeoFeatureId(ref) for ref in row.geo_refs),
        explanation=row.explanation,
    )


def fact_to_record(fact: Fact, owner: FactOwner) -> SearchFactRecord:
    qualifiers = {
        key: list(value) if isinstance(value, tuple) else value
        for key, value in fact.qualifiers.items()
        if not (key == "facade_azimuth" and owner.facade_azimuth is not None)
    }
    provenance = fact.provenance
    return SearchFactRecord(
        hotel_id=owner.hotel_id,
        id=str(fact.id),
        characteristic_key=fact.characteristic_key,
        value=dict(fact.value) if isinstance(fact.value, Mapping) else fact.value,
        unit=fact.unit,
        qualifiers=qualifiers,
        source_type=provenance.source_type.value,
        source_id=provenance.source.ref,
        method=provenance.method,
        confidence=provenance.confidence.value,
        computed_at=provenance.computed_at,
        valid_until=provenance.valid_until,
        status=fact.status.value,
        geo_refs=tuple(str(ref) for ref in fact.geo_refs),
        explanation=fact.explanation,
        facade_azimuth=owner.facade_azimuth,
        subject_id=owner.subject_id,
        source_url=provenance.source.url,
        observed_at=provenance.observed_at,
        evidence=tuple((item.kind.value, item.text) for item in provenance.evidence),
    )
