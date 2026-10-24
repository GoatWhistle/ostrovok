from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest

from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.entities import Fact, FactStatus, FactValue, QualifierValue
from hotel_agent.domain.value_objects import (
    Confidence,
    FactId,
    HotelId,
    Provenance,
    SourceRef,
    Subject,
)

NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)
SUBJECT = Subject.hotel(HotelId("h_1"))

type FactMaker = Callable[..., Fact]


@pytest.fixture
def now() -> datetime:
    return NOW


@pytest.fixture
def make_fact() -> FactMaker:
    def build(
        fact_id: str = "f_1",
        value: FactValue = 6.0,
        *,
        source: SourceType = SourceType.COMPUTED,
        confidence: float = 0.8,
        age_days: float = 0.0,
        ttl_days: float | None = 365.0,
        status: FactStatus = FactStatus.ACTIVE,
        characteristic_key: str = "distance_to_sea",
        qualifiers: dict[str, QualifierValue] | None = None,
    ) -> Fact:
        computed_at = NOW - timedelta(days=age_days)
        return Fact(
            id=FactId(fact_id),
            subject=SUBJECT,
            characteristic_key=characteristic_key,
            value=value,
            provenance=Provenance(
                source=SourceRef(source_type=source),
                method=f"{characteristic_key}@1",
                confidence=Confidence(confidence),
                computed_at=computed_at,
                valid_until=(
                    computed_at + timedelta(days=ttl_days) if ttl_days is not None else None
                ),
            ),
            status=status,
            qualifiers=qualifiers or {},
        )

    return build
