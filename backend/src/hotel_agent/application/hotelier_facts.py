from datetime import datetime, timedelta

from hotel_agent.application.fact_values import checked_value
from hotel_agent.application.ports.llm import Extraction
from hotel_agent.domain.characteristics import Characteristic, ValueType
from hotel_agent.domain.entities import Fact, FactStatus
from hotel_agent.domain.value_objects import (
    Confidence,
    Evidence,
    EvidenceKind,
    FactId,
    Provenance,
    SourceRef,
    Subject,
)

HIDDEN_FIELDS = frozenset({"allowed", "present"})


def hotelier_fact(
    *,
    fact_id: FactId,
    subject: Subject,
    characteristic: Characteristic,
    extraction: Extraction,
    text: str,
    method: str,
    source: SourceRef,
    now: datetime,
) -> Fact:
    values = {field.name: field.value for field in extraction.fields}
    value = checked_value(
        values if characteristic.value_type is ValueType.OBJECT else next(iter(values.values())),
        characteristic.value_type,
    )
    return Fact(
        id=fact_id,
        subject=subject,
        characteristic_key=characteristic.key,
        value=value,
        unit=characteristic.unit,
        qualifiers={
            key: item
            for key, item in values.items()
            if key not in HIDDEN_FIELDS and item is not None
        }
        if characteristic.value_type is ValueType.OBJECT
        else {},
        status=FactStatus.CONFIRMED_BY_HOTELIER,
        explanation=text,
        provenance=Provenance(
            source=source,
            method=method,
            confidence=Confidence(1),
            computed_at=now,
            observed_at=now,
            valid_until=now + timedelta(days=characteristic.ttl_days),
            evidence=tuple(
                Evidence(kind=EvidenceKind.QUOTE, text=item.quote) for item in extraction.fields
            ),
        ),
    )
