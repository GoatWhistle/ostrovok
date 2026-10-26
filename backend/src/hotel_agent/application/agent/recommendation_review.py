import json
from collections.abc import Mapping, Sequence
from dataclasses import asdict

from hotel_agent.application.agent.semantic_review import ReviewClaim, ReviewResult, SemanticReview
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality, Scored


def fact_evidence(fact: Fact | None) -> dict[str, object] | None:
    if fact is None:
        return None
    return {
        "id": str(fact.id),
        "value": dict(fact.value) if isinstance(fact.value, Mapping) else fact.value,
        "unit": fact.unit,
        "qualifiers": dict(fact.qualifiers),
        "explanation": fact.explanation,
        "source_type": str(fact.provenance.source_type),
        "source_id": fact.provenance.source.ref,
        "method": fact.provenance.method,
        "confidence": fact.provenance.confidence.value,
        "computed_at": fact.provenance.computed_at.isoformat(),
        "valid_until": fact.provenance.valid_until.isoformat()
        if fact.provenance.valid_until
        else None,
    }


def recommendation_claim(
    hotel: SearchHotelRecord, scored: Scored, parsed: ParsedQuery
) -> ReviewClaim:
    claims = [
        {"wish": match.intent.source_text, "quality": str(match.quality)}
        for match in scored.matches
    ]
    evidence = {
        "hotel": asdict(hotel),
        "facts": [
            {
                "wish": match.intent.source_text,
                "quality": str(match.quality),
                "fact": fact_evidence(match.fact),
            }
            for match in scored.matches
        ],
        "unverified_wishes": list(parsed.unmatched_terms),
        "stay": {
            "check_in": str(parsed.check_in) if parsed.check_in else None,
            "check_out": str(parsed.check_out) if parsed.check_out else None,
            "adults": parsed.adults,
            "budget": parsed.budget,
        },
    }
    answer = {
        "recommended_hotel_id": hotel.id,
        "matches": claims,
        "all_conditions_verified": bool(scored.matches)
        and all(item.quality is MatchQuality.FULL for item in scored.matches)
        and not parsed.unmatched_terms,
    }
    return ReviewClaim(
        hotel.id, json.dumps(answer, ensure_ascii=False), json.dumps(evidence, ensure_ascii=False)
    )


class RecommendationReview:
    def __init__(self, review: SemanticReview, max_candidates: int = 60) -> None:
        self._review, self._max_candidates = review, max_candidates

    async def check(
        self,
        query: str,
        parsed: ParsedQuery,
        candidates: Sequence[tuple[SearchHotelRecord, Scored]],
        limit: int,
    ) -> ReviewResult:
        accepted: list[str] = []
        rejected: list[str] = []
        for offset in range(0, min(len(candidates), self._max_candidates), 12):
            batch = candidates[offset : min(offset + 12, self._max_candidates)]
            report = await self._review.check(
                query,
                "recommendation_scope",
                [recommendation_claim(hotel, scored, parsed) for hotel, scored in batch],
            )
            accepted.extend(report.accepted_ids)
            rejected.extend(report.rejected_ids)
            if report.unavailable or len(accepted) >= limit:
                return ReviewResult(tuple(accepted), tuple(rejected), report.unavailable)
        return ReviewResult(tuple(accepted), tuple(rejected))
