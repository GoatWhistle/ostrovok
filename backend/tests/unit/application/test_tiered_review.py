import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.semantic_review import ReviewClaim, SemanticReview
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.errors import ModelFailure

SOURCE = "Distance to the beach is 120 metres along the promenade."
CLAIMS = tuple(ReviewClaim(name, f"{name} is by the sea", SOURCE) for name in ("a", "b", "c"))


def judge(accepted: set[str], quote: str = "Distance to the beach is 120 metres") -> AsyncMock:
    async def verify(context: str) -> tuple[EvidenceVerdict, ...]:
        return tuple(
            EvidenceVerdict(record_id=row["record_id"], supported=True, quote=quote)
            for row in json.loads(context)["records"]
            if row["record_id"] in accepted
        )

    return AsyncMock(side_effect=verify)


def reviewed(context: object) -> list[str]:
    return [row["record_id"] for row in json.loads(str(context))["records"]]


async def test_first_model_approvals_stand_and_only_its_rejections_reach_the_main_model() -> None:
    first = SimpleNamespace(verify_evidence=judge({"a"}))
    main = SimpleNamespace(verify_evidence=judge({"c"}))
    review = SemanticReview(cast(LLMPort, main), MagicMock(), first=cast(LLMPort, first))

    report = await review.check("by the sea", "recommendation_scope", CLAIMS)

    assert report.accepted_ids == ("a", "c")
    assert report.rejected_ids == ("b",)
    assert reviewed(main.verify_evidence.await_args.args[0]) == ["b", "c"]


async def test_short_quote_from_the_first_model_is_rechecked_not_accepted() -> None:
    first = SimpleNamespace(verify_evidence=judge({"a", "b", "c"}, quote="beach"))
    main = SimpleNamespace(verify_evidence=judge(set()))
    review = SemanticReview(cast(LLMPort, main), MagicMock(), first=cast(LLMPort, first))

    report = await review.check("by the sea", "recommendation_scope", CLAIMS)

    assert not report.accepted_ids
    assert report.rejected_ids == ("a", "b", "c")
    assert reviewed(main.verify_evidence.await_args.args[0]) == ["a", "b", "c"]


async def test_unavailable_first_model_hands_every_claim_to_the_main_model() -> None:
    first = SimpleNamespace(verify_evidence=AsyncMock(side_effect=ModelFailure("down")))
    main = SimpleNamespace(verify_evidence=judge({"a", "b", "c"}))
    review = SemanticReview(cast(LLMPort, main), MagicMock(), first=cast(LLMPort, first))

    report = await review.check("by the sea", "answer_scope", CLAIMS)

    assert report.accepted_ids == ("a", "b", "c")
    assert not report.unavailable


async def test_main_model_is_skipped_when_the_first_model_approves_everything() -> None:
    first = SimpleNamespace(verify_evidence=judge({"a", "b", "c"}))
    main = SimpleNamespace(verify_evidence=judge(set()))
    review = SemanticReview(cast(LLMPort, main), MagicMock(), first=cast(LLMPort, first))

    report = await review.check("by the sea", "recommendation_scope", CLAIMS)

    assert report.accepted_ids == ("a", "b", "c")
    main.verify_evidence.assert_not_awaited()
