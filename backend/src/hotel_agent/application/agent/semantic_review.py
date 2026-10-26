import asyncio
import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure


@dataclass(frozen=True, slots=True)
class ReviewClaim:
    id: str
    answer: str
    evidence: str


@dataclass(frozen=True, slots=True)
class ReviewResult:
    accepted_ids: tuple[str, ...] = ()
    rejected_ids: tuple[str, ...] = ()
    unavailable: bool = False


class SemanticReview:
    def __init__(self, llm: LLMPort, logger: LoggerPort, timeout_s: float = 30) -> None:
        self._llm, self._logger, self._timeout = llm, logger, timeout_s

    async def check(self, query: str, mode: str, claims: Sequence[ReviewClaim]) -> ReviewResult:
        if not claims:
            return ReviewResult()
        sources = {claim.id: claim.evidence for claim in claims}
        if len(sources) != len(claims):
            raise ValueError("Semantic review claim identifiers must be unique")
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
                verdicts = tuple(await self._llm.verify_evidence(context))
        except (ModelFailure, TimeoutError):
            self._logger.warning("semantic_review_unavailable", mode=mode, claims=len(claims))
            return ReviewResult(unavailable=True)
        counts = Counter(verdict.record_id for verdict in verdicts)
        accepted = tuple(
            verdict.record_id
            for verdict in verdicts
            if counts[verdict.record_id] == 1
            and verdict.supported
            and verdict.record_id in sources
            and len(verdict.quote.strip()) >= 12
            and verdict.quote in sources[verdict.record_id]
        )
        rejected = tuple(claim.id for claim in claims if claim.id not in accepted)
        self._logger.info(
            "semantic_review_finished", mode=mode, accepted=len(accepted), rejected=len(rejected)
        )
        return ReviewResult(accepted, rejected)
