import json
from dataclasses import replace
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from hotel_agent.application.agent.chat_answer_review import ChatAnswerReview, safe_answer
from hotel_agent.application.agent.semantic_review import ReviewResult, SemanticReview
from hotel_agent.application.agent.wish_records import WishResult, WishStatus
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.use_cases.search_hotels import SearchOutcome, SearchResult
from hotel_agent.domain.query import ParsedQuery
from tests.unit.application.test_chat_conversations import build
from tests.unit.application.test_recommendation_review import candidates


@pytest.mark.parametrize("locale", ("ru", "en"))
async def test_rejected_answer_is_replaced_before_being_saved_in_the_chat(locale: str) -> None:
    parsed = ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи", wants_room=True)
    harness = build(parsed)
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=()))
    harness.chat._review = ChatAnswerReview(SemanticReview(cast(LLMPort, llm), MagicMock()))
    unsupported = "Вам гарантирован двухместный номер на 17 этаже, завтрак включён!"
    with patch.object(harness.chat, "_answer", return_value=unsupported):
        outcome = await harness.chat.send(None, "Отель в Сочи", "sochi", None, locale)
    saved = outcome.conversation.messages[-1].content
    assert unsupported not in saved
    assert "guaranteed" not in saved
    assert (
        ("Уточните условия поиска" in saved)
        if locale == "ru"
        else ("clarify the search conditions" in saved)
    )
    assert "дату заезда" not in saved and "check-in date" not in saved
    context = json.loads(llm.verify_evidence.await_args.args[0])
    assert context["request"] == "Отель в Сочи"
    assert context["mode"] == "answer_scope"
    assert context["records"][0]["proposed_answer"] == unsupported
    assert unsupported not in context["records"][0]["source_text"]
    assert harness.commits == [True]


async def test_a_supported_answer_is_preserved() -> None:
    harness = build(ParsedQuery(intents=(), unmatched_terms=(), location_hint=None))
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=(
                EvidenceVerdict(record_id="answer", supported=True, quote='"location_hint": null'),
            )
        )
    )
    harness.chat._review = ChatAnswerReview(SemanticReview(cast(LLMPort, llm), MagicMock()))
    outcome = await harness.chat.send(None, "Хочу отель", "russia", None)
    assert outcome.conversation.messages[-1].content == "В каком городе ищете отель?"


async def test_answer_review_receives_unknowns_and_partial_matches_without_upgrading_them() -> None:
    parsed, rows = candidates(1)
    scored = replace(rows[0][1], matches=(replace(rows[0][1].matches[0], fact=None),))
    outcome = SearchOutcome(
        query_id="q", parsed=parsed, results=(SearchResult(hotel=rows[0][0], scored=scored),)
    )
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=()))
    accepted = await ChatAnswerReview(SemanticReview(cast(LLMPort, llm), MagicMock())).accepts(
        "Запрос",
        "Номер забронирован",
        outcome,
    )
    assert not accepted
    context = json.loads(llm.verify_evidence.await_args.args[0])
    evidence = json.loads(context["records"][0]["source_text"])
    assert evidence["results"][0]["facts"][0]["fact"] is None
    assert evidence["stay"]["check_in"] is None
    assert evidence["result_count"] == 1


@pytest.mark.parametrize("locale", ("ru", "en"))
def test_unavailable_recommendation_verification_does_not_claim_hotel_absence(locale: str) -> None:
    outcome = SearchOutcome(
        query_id="q",
        parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
        results=(),
        review=ReviewResult(unavailable=True),
    )
    answer = safe_answer(outcome, locale)
    assert ("закончить проверку" in answer) if locale == "ru" else ("finish verifying" in answer)
    assert "not find" not in answer and "не нашёл" not in answer


def test_timed_out_check_is_not_reported_as_verified_absence() -> None:
    search = SearchOutcome(
        query_id="q",
        parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Москва"),
        results=(),
        wish_results=(
            WishResult("рядом с Вкусвилл", WishStatus.INCOMPLETE, "не успели", 12, (), ()),
        ),
    )

    answer = safe_answer(search, "ru")

    assert "Не успел закончить проверку" in answer
    assert "рядом с Вкусвилл" in answer
