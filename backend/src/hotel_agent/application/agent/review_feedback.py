from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.domain.services.scoring import COUNTED_QUALITIES, Scored

STRUCTURAL = {"no_verified_wish"}
NOTE = (
    "The final review rejected the previous recommendation built on these sources."
    " Treat them as insufficient for this wish: look for another source that states the wish"
    " about this exact hotel, or finish honestly without a match."
    " Do not weaken the wish and do not reuse the rejected quote."
)


@dataclass(frozen=True, slots=True)
class ReviewFeedback:
    hotel: str
    reason: str
    wishes: tuple[str, ...]
    sources: tuple[str, ...]


def source_urls(value: object) -> tuple[str, ...]:
    return tuple(str(item) for item in value) if isinstance(value, list | tuple) else ()


def rejection_feedback(
    candidates: Sequence[tuple[SearchHotelRecord, Scored]],
    report: ReviewResult | None,
    limit: int = 3,
) -> tuple[ReviewFeedback, ...]:
    if report is None or report.unavailable or report.accepted_ids:
        return ()
    scored = {hotel.id: (hotel, item) for hotel, item in candidates}
    feedback = []
    for rejection in report.rejections:
        if rejection.cause in STRUCTURAL or rejection.id not in scored:
            continue
        hotel, item = scored[rejection.id]
        supported = [row for row in item.matches if row.quality in COUNTED_QUALITIES]
        if not supported:
            continue
        feedback.append(
            ReviewFeedback(
                hotel=f"{hotel.name} ({hotel.id})",
                reason=rejection.reason or rejection.cause,
                wishes=tuple(dict.fromkeys(row.intent.source_text for row in supported)),
                sources=tuple(
                    dict.fromkeys(
                        url
                        for row in supported
                        if row.fact
                        for url in source_urls(row.fact.qualifiers.get("source_urls"))
                    )
                ),
            )
        )
    return tuple(feedback[:limit])


def research_note(feedback: Sequence[ReviewFeedback]) -> dict[str, Any] | None:
    if not feedback:
        return None
    return {
        "tool": "recommendation_review",
        "result": {
            "error": NOTE,
            "rejected": [
                {
                    "hotel": row.hotel,
                    "reason": row.reason,
                    "wishes": list(row.wishes),
                    "sources": list(row.sources),
                }
                for row in feedback
            ],
        },
    }
