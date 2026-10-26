from dataclasses import dataclass
from enum import StrEnum


class WishStatus(StrEnum):
    MATCHED = "matched"
    EXHAUSTED = "exhausted"
    NEEDS_INPUT = "needs_input"
    INCOMPLETE = "incomplete"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True, slots=True)
class WishResult:
    term: str
    status: WishStatus
    reason: str
    tool_calls: int
    checked_sources: tuple[str, ...]
    matched_hotel_ids: tuple[str, ...] = ()
