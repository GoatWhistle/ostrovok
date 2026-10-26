import asyncio
import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.agent.semantic_review import ReviewClaim, SemanticReview
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.errors import ModelFailure

SOURCE = "The hotel has a restaurant. Breakfast is charged separately."
CLAIM = ReviewClaim("hotel", "Завтрак оплачивается отдельно", SOURCE)


@pytest.mark.parametrize(
    ("verdicts", "accepted"),
    (
        (
            (
                EvidenceVerdict(
                    record_id="hotel", supported=True, quote="Breakfast is charged separately."
                ),
            ),
            True,
        ),
        (
            (
                EvidenceVerdict(
                    record_id="hotel", supported=False, quote="Breakfast is charged separately."
                ),
            ),
            False,
        ),
        (
            (
                EvidenceVerdict(
                    record_id="hotel", supported=True, quote="Breakfast is included in every rate."
                ),
            ),
            False,
        ),
        ((EvidenceVerdict(record_id="other", supported=True, quote=SOURCE),), False),
        ((EvidenceVerdict(record_id="hotel", supported=True, quote="restaurant"),), False),
        ((EvidenceVerdict(record_id="hotel", supported=True, quote=CLAIM.answer),), False),
        ((EvidenceVerdict(record_id="hotel", supported=True, quote=SOURCE),) * 2, False),
        ((), False),
    ),
)
async def test_review_requires_a_unique_supported_verdict_grounded_in_evidence(
    verdicts: tuple[EvidenceVerdict, ...],
    accepted: bool,
) -> None:
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=verdicts))
    report = await SemanticReview(cast(LLMPort, llm), MagicMock()).check(
        "Отель с включённым завтраком",
        "recommendation_scope",
        (CLAIM,),
    )
    assert ("hotel" in report.accepted_ids) is accepted
    assert ("hotel" in report.rejected_ids) is not accepted
    context = json.loads(llm.verify_evidence.await_args.args[0])
    assert context["request"] == "Отель с включённым завтраком"
    assert context["records"][0]["proposed_answer"] == CLAIM.answer
    assert context["records"][0]["source_text"] == SOURCE


async def test_model_failure_is_unavailable_and_does_not_approve_the_answer() -> None:
    llm = SimpleNamespace(verify_evidence=AsyncMock(side_effect=ModelFailure()))
    report = await SemanticReview(cast(LLMPort, llm), MagicMock()).check(
        "Запрос", "answer_scope", (CLAIM,)
    )
    assert report.unavailable
    assert not report.accepted_ids
    assert not report.rejected_ids


async def test_timeout_is_not_a_negative_semantic_verdict() -> None:
    async def delayed(_: str) -> tuple[EvidenceVerdict, ...]:
        await asyncio.sleep(0.05)
        return ()

    review = SemanticReview(
        cast(LLMPort, SimpleNamespace(verify_evidence=delayed)), MagicMock(), timeout_s=0.001
    )
    result = await review.check("Запрос", "answer_scope", (CLAIM,))
    assert result.unavailable
    assert not result.accepted_ids
    assert not result.rejected_ids


async def test_rejection_of_one_claim_does_not_remove_an_independently_supported_claim() -> None:
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=(
                EvidenceVerdict(record_id="hotel", supported=False, quote=SOURCE),
                EvidenceVerdict(
                    record_id="other", supported=True, quote="Breakfast is charged separately."
                ),
            )
        )
    )
    result = await SemanticReview(cast(LLMPort, llm), MagicMock()).check(
        "Запрос",
        "answer_scope",
        (
            CLAIM,
            ReviewClaim("other", "Завтрак оплачивается отдельно", SOURCE),
        ),
    )
    assert result.accepted_ids == ("other",)
    assert result.rejected_ids == ("hotel",)


async def test_empty_review_does_not_call_a_model_and_duplicate_claim_ids_are_rejected() -> None:
    llm = SimpleNamespace(verify_evidence=AsyncMock())
    review = SemanticReview(cast(LLMPort, llm), MagicMock())
    assert not (await review.check("Запрос", "answer_scope", ())).accepted_ids
    with pytest.raises(ValueError, match="identifiers must be unique"):
        await review.check("Запрос", "answer_scope", (CLAIM, CLAIM))
    llm.verify_evidence.assert_not_awaited()


async def test_review_logs_semantic_refusal_separately_from_broken_quote() -> None:
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=(
                EvidenceVerdict(record_id="hotel", supported=False, quote=SOURCE),
                EvidenceVerdict(record_id="other", supported=True, quote="This quote is absent."),
            )
        )
    )
    logger = MagicMock()
    await SemanticReview(cast(LLMPort, llm), logger).check(
        "Запрос", "recommendation_scope", (CLAIM, ReviewClaim("other", CLAIM.answer, SOURCE))
    )
    details = json.loads(logger.info.call_args.kwargs["rejection_reasons"])
    assert details == {"unsupported": 1, "ungrounded_quote": 1}


async def test_cosmetically_different_quote_is_still_rejected_but_counted() -> None:
    logged: list[dict[str, object]] = []
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=[
                EvidenceVerdict(
                    record_id="h1",
                    supported=True,
                    quote='Гостиница  "Англетер"\nв Петербурге',
                    reason="Источник называет гостиницу",
                )
            ]
        )
    )
    logger = SimpleNamespace(
        info=lambda event, **fields: logged.append({"event": event, **fields}),
        warning=lambda *_, **__: None,
    )
    review = SemanticReview(cast(LLMPort, llm), cast(LoggerPort, logger))

    result = await review.check(
        "где жил поэт",
        "recommendation_scope",
        [ReviewClaim("h1", "{}", 'Гостиница «Англетер» в Петербурге')],
    )

    assert result.accepted_ids == ()
    assert result.rejections[0].cause == "ungrounded_quote"
    assert logged[-1]["cosmetic_quote_mismatches"] == 1
