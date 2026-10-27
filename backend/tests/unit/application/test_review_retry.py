from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.semantic_review import SemanticReview
from hotel_agent.application.agent.wish_evidence import wish_intent, wish_key
from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.domain.query import ParsedQuery

NOW = datetime(2026, 10, 26, tzinfo=UTC)
TERM = "где жил поэт"
QUERY = "гостиница в Петербурге, где жил поэт"


def hotel() -> SearchHotelRecord:
    return SearchHotelRecord(
        id="h1",
        region_id="russia",
        name="Англетер",
        location=(30.3, 59.9),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def confirmed(url: str, quote: str) -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id="h1",
        id=f"f_wish_{wish_key(TERM)[8:]}_h1",
        characteristic_key=wish_key(TERM),
        value=True,
        unit=None,
        qualifiers={"source_text": TERM, "source_quotes": [quote], "source_urls": [url]},
        source_type="computed",
        source_id=url,
        method="data_agent_tools@1",
        confidence=0.7,
        computed_at=NOW,
        valid_until=NOW + timedelta(hours=1),
        status="active",
        geo_refs=(),
        explanation=quote,
        facade_azimuth=None,
    )


def outcome(url: str, quote: str) -> ExplorationOutcome:
    return ExplorationOutcome(
        hotels=(hotel(),),
        bbox=None,
        intents=(wish_intent(TERM),),
        facts=(confirmed(url, quote),),
        resolved_terms=(TERM,),
        processed_terms=(TERM,),
    )


def build(
    outcomes: list[ExplorationOutcome],
    verdicts: list[list[EvidenceVerdict]],
    terms: tuple[str, ...] = (TERM,),
) -> tuple[SearchHotels, AsyncMock, AsyncMock]:
    parsed = ParsedQuery(
        intents=tuple(wish_intent(item) for item in terms),
        unmatched_terms=(),
        location_hint="Санкт-Петербург",
    )
    llm = SimpleNamespace(
        parse_query=AsyncMock(return_value=parsed), verify_evidence=AsyncMock(side_effect=verdicts)
    )
    search = SimpleNamespace(
        list_hotels=AsyncMock(return_value=[hotel()]),
        by_ids=AsyncMock(return_value=[hotel()]),
        list_facts=AsyncMock(return_value=[]),
        list_supplier_content=AsyncMock(return_value=[]),
        save_facts=AsyncMock(),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            regions=SimpleNamespace(
                city_bbox=AsyncMock(return_value=(30.1, 59.8, 30.5, 60.0)),
                local_area=AsyncMock(return_value=None),
            ),
            search=search,
            nearby_objects=SimpleNamespace(),
            named_places=SimpleNamespace(geographic_name=AsyncMock(return_value=None)),
            geo_features=SimpleNamespace(save_batch=AsyncMock()),
            commit=AsyncMock(),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    explorer = AsyncMock(side_effect=outcomes)
    logger = SimpleNamespace(info=lambda *_, **__: None, warning=lambda *_, **__: None)
    use_case = SearchHotels(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, lambda: scope),
        cast(ClockPort, SimpleNamespace(now=lambda: NOW)),
        explorer=cast(DataExplorer, explorer),
        review=RecommendationReview(SemanticReview(cast(LLMPort, llm), cast(LoggerPort, logger))),
    )
    return use_case, explorer, cast(AsyncMock, llm.verify_evidence)


async def test_rejected_recommendation_sends_the_reason_back_into_research() -> None:
    first, second = "https://a.example/death", "https://b.example/residence"
    use_case, explorer, _ = build(
        [outcome(first, "Поэт умер в этой гостинице"), outcome(second, "Поэт жил здесь в 1925")],
        [
            [
                EvidenceVerdict(
                    record_id="h1",
                    supported=False,
                    quote="",
                    reason="Источник говорит о смерти, а не о проживании",
                )
            ],
            [EvidenceVerdict(record_id="h1", supported=True, quote='"value": true')],
        ],
    )

    result = await use_case(QUERY, "russia", None, 20)

    assert [item.hotel.id for item in result.results] == ["h1"]
    assert explorer.await_count == 2
    feedback = explorer.await_args_list[-1].kwargs["feedback"]
    assert feedback[0].sources == (first,)
    assert feedback[0].wishes == (TERM,)
    assert "смерти" in feedback[0].reason


async def test_unverified_wish_is_not_retried_and_stays_an_honest_empty_answer() -> None:
    use_case, explorer, verify = build([ExplorationOutcome(hotels=(hotel(),), bbox=None)], [])

    result = await use_case(QUERY, "russia", None, 20)

    assert result.results == []
    assert explorer.await_count == 1
    verify.assert_not_awaited()


async def test_only_the_doubted_wish_is_explored_again() -> None:
    other = "с завтраком"
    first, second = "https://a.example/death", "https://b.example/residence"
    use_case, explorer, _ = build(
        [
            ExplorationOutcome(
                hotels=(hotel(),),
                bbox=None,
                intents=(wish_intent(TERM), wish_intent(other)),
                facts=(confirmed(first, "Поэт умер в этой гостинице"),),
                resolved_terms=(TERM, other),
                processed_terms=(TERM, other),
            ),
            outcome(second, "Поэт жил здесь в 1925"),
        ],
        [
            [
                EvidenceVerdict(
                    record_id="h1",
                    supported=False,
                    quote="",
                    reason="Источник говорит о смерти, а не о проживании",
                )
            ],
            [EvidenceVerdict(record_id="h1", supported=True, quote='"value": true')],
        ],
        terms=(TERM, other),
    )

    result = await use_case(QUERY, "russia", None, 20)

    assert [item.hotel.id for item in result.results] == ["h1"]
    assert explorer.await_args_list[0].args[1] == (TERM, other)
    assert explorer.await_args_list[1].args[1] == (TERM,)
