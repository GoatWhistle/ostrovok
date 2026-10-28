import asyncio
import json
import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure

WHITESPACE = re.compile(r"\s+")
MIN_QUOTE = 12


def grounded(quote: str, source: str) -> bool:
    return quote in source or comparable(quote) in comparable(source)


def comparable(text: str) -> str:
    return WHITESPACE.sub(
        " ",
        text.casefold()
        .replace("ё", "е")
        .replace("«", '"')
        .replace("»", '"')
        .replace("\\n", " ")
        .replace('\\"', '"'),
    ).strip()


@dataclass(frozen=True, slots=True)
class ReviewClaim:
    id: str
    answer: str
    evidence: str


@dataclass(frozen=True, slots=True)
class ReviewRejection:
    id: str
    cause: str
    reason: str = ""


@dataclass(frozen=True, slots=True)
class ReviewResult:
    accepted_ids: tuple[str, ...] = ()
    rejected_ids: tuple[str, ...] = ()
    unavailable: bool = False
    rejections: tuple[ReviewRejection, ...] = ()


class SemanticReview:
    def __init__(
        self,
        llm: LLMPort,
        logger: LoggerPort,
        timeout_s: float = 30,
        first: LLMPort | None = None,
    ) -> None:
        self._llm, self._logger, self._timeout, self._first = llm, logger, timeout_s, first

    async def check(self, query: str, mode: str, claims: Sequence[ReviewClaim]) -> ReviewResult:
        if not claims:
            return ReviewResult()
        if len({claim.id for claim in claims}) != len(claims):
            raise ValueError("Semantic review claim identifiers must be unique")
        if self._first is None:
            return await self._judge(self._llm, "main", query, mode, claims)
        quick = await self._judge(self._first, "first", query, mode, claims)
        doubted = [claim for claim in claims if claim.id not in quick.accepted_ids]
        if not doubted:
            return quick
        final = await self._judge(self._llm, "main", query, mode, doubted)
        return ReviewResult(
            quick.accepted_ids + final.accepted_ids,
            final.rejected_ids,
            final.unavailable,
            final.rejections,
        )

    async def _judge(
        self, llm: LLMPort, tier: str, query: str, mode: str, claims: Sequence[ReviewClaim]
    ) -> ReviewResult:
        sources = {claim.id: claim.evidence for claim in claims}
        context = json.dumps(
            {
                "mode": mode,
                "request": query,
                "wish": "Проверь соответствие ответа смыслу запроса и подтверждениям источников.",
                "records": [
                    {
                        "record_id": claim.id,
                        "proposed_answer": claim.answer,
                        "source_text": claim.evidence,
                    }
                    for claim in claims
                ],
            },
            ensure_ascii=False,
        )
        try:
            async with asyncio.timeout(self._timeout):
                verdicts = tuple(await llm.verify_evidence(context))
        except (ModelFailure, TimeoutError):
            self._logger.warning(
                "semantic_review_unavailable", mode=mode, tier=tier, claims=len(claims)
            )
            return ReviewResult(unavailable=True)
        counts = Counter(verdict.record_id for verdict in verdicts)
        accepted = tuple(
            verdict.record_id
            for verdict in verdicts
            if counts[verdict.record_id] == 1
            and verdict.supported
            and verdict.record_id in sources
            and len(verdict.quote.strip()) >= MIN_QUOTE
            and grounded(verdict.quote, sources[verdict.record_id])
        )
        rejected = tuple(claim.id for claim in claims if claim.id not in accepted)
        by_id = {verdict.record_id: verdict for verdict in verdicts}
        reasons: Counter[str] = Counter()
        rejections = []
        refused: list[str] = []
        for identifier in rejected:
            verdict = by_id.get(identifier)
            cause = (
                "missing_verdict"
                if verdict is None
                else "duplicate_verdict"
                if counts[identifier] != 1
                else "unsupported"
                if not verdict.supported
                else "short_quote"
                if len(verdict.quote.strip()) < MIN_QUOTE
                else "ungrounded_quote"
            )
            reasons[cause] += 1
            if cause in {"short_quote", "ungrounded_quote"} and verdict is not None:
                refused.append(verdict.quote.strip()[:60])
            rejections.append(ReviewRejection(identifier, cause, verdict.reason if verdict else ""))
        self._logger.info(
            "semantic_review_finished",
            mode=mode,
            tier=tier,
            accepted=len(accepted),
            rejected=len(rejected),
            rejection_reasons=json.dumps(reasons, sort_keys=True),
            refused_quotes=json.dumps(refused[:4], ensure_ascii=False),
            rejection_notes=json.dumps(
                [row.reason for row in rejections if row.reason][:4], ensure_ascii=False
            ),
        )
        return ReviewResult(accepted, rejected, rejections=tuple(rejections))
