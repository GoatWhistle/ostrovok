from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.search_evidence import best_facts
from hotel_agent.application.search_ranking import search_rank, view_eligible
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import Scored, score

Candidate = tuple[SearchHotelRecord, Scored]

NEAREST_LIMIT = 5


@dataclass(frozen=True, slots=True)
class Selection:
    ranked: tuple[Candidate, ...] = ()
    accepted: tuple[Candidate, ...] = ()
    report: ReviewResult | None = None


async def select_candidates(
    query: str,
    parsed: ParsedQuery,
    explored: ExplorationOutcome,
    now: datetime,
    review: RecommendationReview | None,
    limit: int,
) -> Selection:
    facts = best_facts(explored.facts)
    ranked = [
        (hotel, score(parsed.intents, facts.get(hotel.id, {}), now)) for hotel in explored.hotels
    ]
    if parsed.intents:
        ranked = [item for item in ranked if not item[1].disqualified and view_eligible(item[1])]
    ranked.sort(key=lambda item: search_rank(item[0], item[1]))
    if parsed.anywhere and (parsed.intents or parsed.unmatched_terms):
        ranked = [item for item in ranked if item[1].score > 0]
    if explored.question:
        ranked = [item for item in ranked if item[1].score > 0]
    if review is None:
        return Selection(tuple(ranked), tuple(ranked))
    report = await review.check(query, parsed, ranked, limit)
    accepted = [item for item in ranked if item[0].id in report.accepted_ids]
    return Selection(tuple(ranked), tuple(accepted), report)


def nearest_matches(ranked: Sequence[Candidate], limit: int) -> tuple[Candidate, ...]:
    return tuple(ranked[: min(limit, NEAREST_LIMIT)])
