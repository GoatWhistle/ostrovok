from collections.abc import Iterable
from datetime import datetime

from hotel_agent.domain.value_objects import Confidence, Provenance

RESIDUAL_AT_EXPIRY = 0.5


def effective(provenance: Provenance, now: datetime) -> Confidence:
    base = provenance.confidence
    if provenance.valid_until is None:
        return base
    span = (provenance.valid_until - provenance.computed_at).total_seconds()
    age = (now - provenance.computed_at).total_seconds()
    lived = min(max(age / span, 0.0), 1.0)
    return base.scaled(1.0 - (1.0 - RESIDUAL_AT_EXPIRY) * lived)


def aggregate(confidences: Iterable[Confidence]) -> Confidence:
    disbelief = 1.0
    seen = False
    for confidence in confidences:
        disbelief *= 1.0 - confidence.value
        seen = True
    return Confidence(1.0 - disbelief) if seen else Confidence(0.0)
