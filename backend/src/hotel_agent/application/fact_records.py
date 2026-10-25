from typing import cast

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.entities import Fact, FactStatus, FactValue
from hotel_agent.domain.value_objects import (
    Azimuth,
    Confidence,
    FactId,
    GeoFeatureId,
    HotelId,
    Provenance,
    SourceRef,
    Subject,
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
            source=SourceRef(source_type=SourceType(row.source_type), ref=row.source_id),
            method=row.method,
            confidence=Confidence(row.confidence),
            computed_at=row.computed_at,
            valid_until=row.valid_until,
        ),
        status=FactStatus(row.status),
        geo_refs=tuple(GeoFeatureId(ref) for ref in row.geo_refs),
        explanation=row.explanation,
    )
