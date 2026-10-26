import json
from dataclasses import replace
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.agent.recommendation_review import (
    RecommendationReview,
    recommendation_claim,
)
from hotel_agent.application.agent.semantic_review import SemanticReview
from hotel_agent.application.agent.wish_evidence import wish_intent
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality, Scored, score
from tests.unit.application.test_city_search import search
from tests.unit.application.test_data_explorer import NOW, hotel
from tests.unit.application.test_wish_native_and_ranking import record


def candidates(count: int) -> tuple[ParsedQuery, list[tuple[SearchHotelRecord, Scored]]]:
    term = "двухместный на 17 этаже"
    intents = tuple(
        Intent(
            characteristic_key=key, op=Op.EQ, value=True, source_text=wish, weight=1, required=True
        )
        for key, wish in (("derived:capacity", "двухместный"), ("derived:floor", "на 17 этаже"))
    )
    parsed = ParsedQuery(intents=intents, unmatched_terms=(), location_hint="Сочи", wishes=(term,))
    results = []
    for index in range(count):
        identifier = str(index)
        facts = {
            key: fact_from_record(
                replace(
                    record(key, True, identifier),
                    qualifiers={
                        "source_quotes": [
                            "Double room on floor 2"
                            if key.endswith("capacity")
                            else "Single room on floor 17"
                        ],
                        "room_id": "double" if key.endswith("capacity") else "single",
                    },
                )
            )
            for key in ("derived:capacity", "derived:floor")
        }
        results.append((hotel(identifier), score(intents, facts, NOW)))
    return parsed, results


async def test_joint_room_conditions_are_reviewed_with_both_actual_room_identities() -> None:
    parsed, rows = candidates(1)
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=()))
    report = await RecommendationReview(SemanticReview(cast(LLMPort, llm), MagicMock())).check(
        "двухместный на 17 этаже в Сочи",
        parsed,
        rows,
        20,
    )
    assert report.rejected_ids == ("0",)
    context = json.loads(llm.verify_evidence.await_args.args[0])
    assert context["mode"] == "recommendation_scope"
    evidence = json.loads(context["records"][0]["source_text"])
    assert [row["fact"]["qualifiers"]["room_id"] for row in evidence["facts"]] == [
        "double",
        "single",
    ]
    assert "двухместный на 17 этаже" in context["request"]
    assert json.loads(context["records"][0]["proposed_answer"])["all_conditions_verified"]


async def test_rejected_first_batch_promotes_supported_candidates_from_the_next_batch() -> None:
    parsed, rows = candidates(14)

    async def verify(context: str) -> tuple[EvidenceVerdict, ...]:
        payload = json.loads(context)
        return tuple(
            EvidenceVerdict(
                record_id=row["record_id"], supported=True, quote="Double room on floor 2"
            )
            for row in payload["records"]
            if row["record_id"] in {"12", "13"}
        )

    llm = SimpleNamespace(verify_evidence=AsyncMock(side_effect=verify))
    report = await RecommendationReview(SemanticReview(cast(LLMPort, llm), MagicMock())).check(
        "двухместный",
        parsed,
        rows,
        2,
    )
    assert report.accepted_ids == ("12", "13")
    assert report.rejected_ids == tuple(str(i) for i in range(12))
    assert llm.verify_evidence.await_count == 2


async def test_candidate_budget_does_not_let_unreviewed_hotels_into_the_approved_ids() -> None:
    parsed, rows = candidates(14)
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=()))
    report = await RecommendationReview(
        SemanticReview(cast(LLMPort, llm), MagicMock()), max_candidates=3
    ).check(
        "Запрос",
        parsed,
        rows,
        20,
    )
    assert not report.accepted_ids
    assert report.rejected_ids == ("0", "1", "2")
    llm.verify_evidence.assert_awaited_once()


async def test_search_filters_rejected_hotels_before_saving_their_facts() -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=("тихо",), location_hint="Москва")
    use_case, _, repository, scope = search(parsed, (37.4, 55.5, 37.9, 56.0))
    first = repository.list_hotels.return_value[0]
    second = replace(first, id="m2", name="Второй отель")
    repository.list_hotels.return_value = [first, second]
    repository.save_facts = AsyncMock()
    scope.__aenter__.return_value.commit = AsyncMock()
    wanted = wish_intent("тихо")
    evidence = tuple(
        replace(
            record(wanted.characteristic_key, True, candidate.id),
            qualifiers={"source_text": "тихо"},
        )
        for candidate in (first, second)
    )
    use_case._explorer = cast(
        DataExplorer,
        AsyncMock(
            return_value=ExplorationOutcome(
                hotels=(first, second),
                intents=(wanted,),
                facts=evidence,
                processed_terms=("тихо",),
            )
        ),
    )
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=(
                EvidenceVerdict(record_id="m1", supported=False, quote='"value": true'),
                EvidenceVerdict(record_id="m2", supported=True, quote='"value": true'),
            )
        )
    )
    use_case._review = RecommendationReview(SemanticReview(cast(LLMPort, llm), MagicMock()))
    outcome = await use_case("тихо в Москве", "russia", None, 20)
    assert [result.hotel.id for result in outcome.results] == ["m2"]
    assert outcome.review and outcome.review.rejected_ids == ("m1",)
    assert {row.hotel_id for row in repository.save_facts.await_args.args[0]} == {"m2"}


def test_estimated_match_review_includes_the_actual_displayed_limitations() -> None:
    parsed, rows = candidates(1)
    candidate, scored = rows[0]
    partial = replace(
        scored.matches[0],
        quality=MatchQuality.PARTIAL,
        fact=fact_from_record(
            replace(
                record("derived:quiet", True, candidate.id),
                explanation="Оценка 0–10 по расстоянию до дорог; не замер звука",
            )
        ),
    )
    claim = recommendation_claim(candidate, replace(scored, matches=(partial,)), parsed)
    displayed = json.loads(claim.answer)["matches"][0]
    assert displayed["guaranteed"] is False
    assert "не замер звука" in displayed["explanation"]
    assert "footprint" not in json.loads(claim.evidence)["hotel"]
