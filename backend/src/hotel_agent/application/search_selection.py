from collections.abc import Awaitable, Callable, Collection, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.search_evidence import best_facts
from hotel_agent.application.search_ranking import search_rank, view_eligible
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality, Scored, score

Candidate = tuple[SearchHotelRecord, Scored]

type Cause = Literal[
    "requirement_unmet",
    "requirement_unknown",
    "view_not_computed",
    "no_evidence",
    "review",
]

REQUIREMENT_UNMET: Cause = "requirement_unmet"
REQUIREMENT_UNKNOWN: Cause = "requirement_unknown"
VIEW_NOT_COMPUTED: Cause = "view_not_computed"
NO_EVIDENCE: Cause = "no_evidence"
REVIEWED_OUT: Cause = "review"
REJECTED_SHOWN = 10
NEAREST_LIMIT = 5


@dataclass(frozen=True, slots=True, kw_only=True)
class Rejection:
    hotel: SearchHotelRecord
    cause: Cause
    closeness: float = 0.0
    characteristic_key: str | None = None
    condition: str = ""
    detail: str = ""


@dataclass(frozen=True, slots=True)
class Selection:
    ranked: tuple[Candidate, ...] = ()
    accepted: tuple[Candidate, ...] = ()
    report: ReviewResult | None = None
    rejected: tuple[Rejection, ...] = ()


async def select_candidates(
    query: str,
    parsed: ParsedQuery,
    explored: ExplorationOutcome,
    now: datetime,
    review: RecommendationReview | None,
    limit: int,
    prioritize: Callable[[Sequence[Candidate]], Awaitable[Sequence[Candidate]]] | None = None,
) -> Selection:
    facts = best_facts(explored.facts)
    ranked = [
        (hotel, score(parsed.intents, facts.get(hotel.id, {}), now)) for hotel in explored.hotels
    ]
    rejected: list[Rejection] = []
    if parsed.intents:
        kept = []
        for item in ranked:
            found = _cause(item[1])
            if found is None:
                kept.append(item)
            else:
                cause, intent = found
                rejected.append(
                    Rejection(
                        hotel=item[0],
                        cause=cause,
                        closeness=item[1].partial,
                        characteristic_key=intent.characteristic_key if intent else None,
                        condition=intent.source_text if intent else "",
                    )
                )
        ranked = kept
    ranked.sort(key=lambda item: search_rank(item[0], item[1]))
    if (parsed.anywhere and (parsed.intents or parsed.unmatched_terms)) or explored.question:
        empty = [item for item in ranked if item[1].score <= 0]
        rejected.extend(
            Rejection(hotel=item[0], cause=NO_EVIDENCE, closeness=item[1].partial) for item in empty
        )
        ranked = [item for item in ranked if item[1].score > 0]
    if prioritize is not None:
        ranked = list(await prioritize(ranked))
    if review is None:
        return Selection(tuple(ranked), tuple(ranked), None, _shown(rejected))
    report = await review.check(query, parsed, ranked, limit)
    accepted = [item for item in ranked if item[0].id in report.accepted_ids]
    rejected.extend(_reviewed_out(ranked, report))
    return Selection(tuple(ranked), tuple(accepted), report, _shown(rejected))


def _cause(scored: Scored) -> tuple[Cause, Intent | None] | None:
    if scored.disqualified:
        return (REQUIREMENT_UNMET, _required(scored, MatchQuality.NONE))
    if not view_eligible(scored):
        return (VIEW_NOT_COMPUTED, None)
    return None


def _required(scored: Scored, quality: MatchQuality) -> Intent | None:
    return next(
        (
            item.intent
            for item in scored.matches
            if item.intent.required and item.quality is quality
        ),
        None,
    )


def _reviewed_out(ranked: list[Candidate], report: ReviewResult) -> list[Rejection]:
    reasons = {item.id: item for item in report.rejections}
    rejected = []
    for hotel, scored in ranked:
        if hotel.id in report.accepted_ids:
            continue
        missing = _required(scored, MatchQuality.UNKNOWN)
        rejected.append(
            Rejection(
                hotel=hotel,
                cause=REVIEWED_OUT if missing is None else REQUIREMENT_UNKNOWN,
                closeness=scored.partial,
                characteristic_key=missing.characteristic_key if missing else None,
                condition=missing.source_text if missing else "",
                detail=reasons[hotel.id].reason if hotel.id in reasons else "",
            )
        )
    return rejected


def _shown(rejected: list[Rejection]) -> tuple[Rejection, ...]:
    rejected.sort(key=lambda item: (-item.closeness, item.hotel.name.casefold()))
    return tuple(rejected[:REJECTED_SHOWN])


def nearest_matches(ranked: Sequence[Candidate], limit: int) -> tuple[Candidate, ...]:
    return tuple(ranked[: min(limit, NEAREST_LIMIT)])


def not_shown(rejected: Sequence[Rejection], shown: Collection[str]) -> tuple[Rejection, ...]:
    return tuple(item for item in rejected if item.hotel.id not in shown)
