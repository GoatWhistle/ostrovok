from dataclasses import dataclass

from hotel_agent.domain.characteristics import Op, ScalarValue


@dataclass(frozen=True, slots=True, kw_only=True)
class Intent:
    characteristic_key: str
    op: Op
    value: ScalarValue
    weight: float
    required: bool
    source_text: str


@dataclass(frozen=True, slots=True, kw_only=True)
class ParsedQuery:
    intents: tuple[Intent, ...]
    unmatched_terms: tuple[str, ...]
    location_hint: str | None
