import json

from hotel_agent.application.agent.recommendation_review import recommendation_claim
from hotel_agent.application.agent.semantic_review import ReviewClaim, SemanticReview
from hotel_agent.application.use_cases.search_hotels import SearchOutcome


class ChatAnswerReview:
    def __init__(self, review: SemanticReview) -> None:
        self._review = review

    async def accepts(self, query: str, answer: str, search: SearchOutcome) -> bool:
        parsed = search.parsed
        evidence = {
            "location_hint": parsed.location_hint,
            "anywhere": parsed.anywhere,
            "unsupported_region": parsed.unsupported_region,
            "needs_clarification": parsed.needs_clarification,
            "stay": {
                "check_in": str(parsed.check_in) if parsed.check_in else None,
                "check_out": str(parsed.check_out) if parsed.check_out else None,
                "adults": parsed.adults,
                "budget": parsed.budget,
            },
            "unverified_wishes": list(parsed.unmatched_terms),
            "wish_statuses": [
                {"wish": row.term, "status": str(row.status)} for row in search.wish_results
            ],
            "result_count": len(search.results),
            "results": [
                json.loads(recommendation_claim(row.hotel, row.scored, parsed).evidence)
                for row in search.results
            ],
            "recommendation_validation_unavailable": bool(
                search.review and search.review.unavailable
            ),
        }
        report = await self._review.check(
            query,
            "answer_scope",
            [
                ReviewClaim("answer", answer, json.dumps(evidence, ensure_ascii=False)),
            ],
        )
        return "answer" in report.accepted_ids


def safe_answer(search: SearchOutcome, locale: str) -> str:
    count = len(search.results)
    if count:
        return (
            f"Showing {count} hotels. The cards mark verified and unknown conditions."
            if locale == "en"
            else f"В подборке {count} отелей. Подтверждённые и неизвестные условия отмечены в карточках."
        )
    if search.review and search.review.unavailable:
        return (
            "I could not finish verifying the recommendations. Please try again."
            if locale == "en"
            else "Не удалось закончить проверку рекомендаций. Попробуйте повторить поиск."
        )
    return (
        "I cannot confirm suitable options from the checked data. Please clarify the search conditions."
        if locale == "en"
        else "Пока не могу подтвердить подходящие варианты по проверенным данным. Уточните условия поиска."
    )
