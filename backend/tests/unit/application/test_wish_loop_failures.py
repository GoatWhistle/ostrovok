import asyncio
import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_loop import WishLoop, time_notice
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.semantic_search import SearchDocument, SemanticSearchPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.domain.errors import ModelFailure
from tests.unit.application.test_data_explorer import NOW, QUERY, build, criterion, hotel


async def test_zero_measurements_do_not_stop_other_sources_from_being_checked() -> None:
    quote = "Located high in the mountains on a rugged alpine ridge."
    explorer, llm, _ = build(
        [
            DataStep(action="measure_terrain", arguments={"radius_m": 1000}),
            DataStep(
                action="search_documents",
                arguments={"query": "alpine ridge"},
                criteria=(criterion(),),
            ),
            DataStep(action="match_records", arguments={"dataset": "retrieved_documents"}),
        ],
        readings={"city": {"elevation_m": 10, "relief_m": 0}},
    )
    explorer._semantic = cast(
        SemanticSearchPort,
        SimpleNamespace(
            search=AsyncMock(
                return_value=[
                    SearchDocument(id="ridge", hotel_id="city", text=quote, source="catalog"),
                ]
            )
        ),
    )
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]
    result = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, False
    )
    assert result.wish_results[0].status is WishStatus.MATCHED
    assert result.wish_results[0].tool_calls == 3
    assert result.facts[0].qualifiers["source_quotes"] == [quote]


async def test_failed_embedding_tool_can_recover_using_database_documents() -> None:
    quote = "Rooms have soundproof walls and face a quiet courtyard."
    explorer, llm, _ = build(
        [
            DataStep(action="search_documents", arguments={"query": "quiet room"}),
            DataStep(action="match_records", arguments={"dataset": "documents"}),
        ],
        rows={"documents": [{"hotel_id": "city", "text": quote}]},
    )
    explorer._semantic = cast(
        SemanticSearchPort,
        SimpleNamespace(
            search=AsyncMock(
                side_effect=ModelFailure("embedding unavailable"),
            )
        ),
    )
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]
    result = await explorer("тихо в Сочи", ("тихо",), "Сочи", "sochi", [hotel("city")], None, False)
    assert result.facts[0].value is True
    assert result.wish_results[0].status is WishStatus.MATCHED
    context = json.loads(llm.explore_data.await_args_list[1].args[0])
    assert context["observations"][-1]["result"]["unavailable"]


async def test_each_wish_has_independent_observations_and_unknowns_do_not_erase_matches() -> None:
    quote = "Rooms face a quiet courtyard with soundproof glazing."
    explorer, llm, _ = build(
        [
            DataStep(action="match_records", arguments={"dataset": "documents"}),
            DataStep(
                action="finish",
                arguments={},
                reason="Проверенные записи не подтверждают проживание под водой.",
                irrelevant_sources=("geography", "environment"),
            ),
            DataStep(action="match_records", arguments={"dataset": "documents"}),
        ],
        rows={"documents": [{"hotel_id": "city", "text": quote}]},
    )

    async def verify(context: str) -> list[EvidenceVerdict]:
        return (
            [EvidenceVerdict(record_id="0", supported=True, quote=quote)]
            if json.loads(context)["wish"] == "тихо"
            else []
        )

    llm.verify_evidence.side_effect = verify
    result = await explorer(
        "под водой и тихо в Сочи",
        ("под водой", "тихо"),
        "Сочи",
        "sochi",
        [hotel("city")],
        None,
        False,
    )
    assert [row.status for row in result.wish_results] == [WishStatus.EXHAUSTED, WishStatus.MATCHED]
    assert [row.value for row in result.facts] == [None, True]
    second = json.loads(llm.explore_data.await_args_list[2].args[0])
    assert second["current_wish"] == "тихо"
    assert all(row["tool"] == "inspect_data" for row in second["observations"])


async def test_unread_pages_reject_a_false_exhaustion_claim() -> None:
    explorer, llm, _ = build(
        [
            DataStep(action="match_records", arguments={"dataset": "documents", "limit": 1}),
            DataStep(
                action="finish",
                arguments={},
                reason="Здесь больше ничего найти невозможно.",
                irrelevant_sources=("geography", "environment"),
            ),
            ModelFailure("planner unavailable"),
        ],
        rows={"documents": [{"hotel_id": "city", "text": "A catalog description."}] * 2},
    )
    result = await explorer(
        "под водой", ("под водой",), "Сочи", "sochi", [hotel("city")], None, False
    )
    assert result.wish_results[0].status is WishStatus.UNAVAILABLE
    assert result.facts[0].value is None
    last = json.loads(llm.explore_data.await_args_list[2].args[0])
    assert last["observations"][-1]["result"]["pending_pages"] == {"documents": 1}


async def test_identical_calls_cannot_loop_forever_or_claim_not_found() -> None:
    explorer, _, _ = build(
        [DataStep(action="match_records", arguments={"dataset": "documents"})] * 4
    )
    result = await explorer(
        "под водой", ("под водой",), "Сочи", "sochi", [hotel("city")], None, False
    )
    assert result.wish_results[0].status is WishStatus.INCOMPLETE
    assert result.wish_results[0].tool_calls == 1
    assert result.facts[0].value is None


async def test_timeout_is_incomplete_not_an_exhausted_catalog() -> None:
    async def wait_for_model(_: str) -> DataStep:
        await asyncio.sleep(0.05)
        return DataStep(action="finish", arguments={})

    llm = cast(LLMPort, SimpleNamespace(explore_data=wait_for_model))
    tools = DataTools(MagicMock(), MagicMock(), [hotel("city")], "Сочи", "sochi", None, False)
    with patch.object(tools, "execute", AsyncMock(return_value={})):
        result = await WishLoop(
            llm, cast(ClockPort, SimpleNamespace(now=lambda: NOW)), MagicMock(), timeout_s=0.001
        ).run("под водой", "под водой", tools)
    assert result.wish_results[0].status is WishStatus.INCOMPLETE
    assert result.facts[0].value is None


async def test_embedding_similarity_without_a_supported_quote_stays_unknown() -> None:
    explorer, _, _ = build(
        [
            DataStep(action="search_documents", arguments={"query": "underwater accommodation"}),
            DataStep(action="match_records", arguments={"dataset": "retrieved_documents"}),
            DataStep(
                action="finish",
                arguments={},
                reason="Адрес и высокий similarity не подтверждают проживание под водой.",
                irrelevant_sources=("database", "geography", "environment"),
            ),
        ]
    )
    explorer._semantic = cast(
        SemanticSearchPort,
        SimpleNamespace(
            search=AsyncMock(
                return_value=[
                    SearchDocument(
                        id="fake",
                        hotel_id="city",
                        text="Улица Подводников",
                        source="OSM",
                        relevance=0.99,
                    ),
                ]
            )
        ),
    )
    result = await explorer(
        "под водой", ("под водой",), "Сочи", "sochi", [hotel("city")], None, False
    )
    assert result.facts[0].value is None
    assert not result.resolved_terms


async def test_repeated_web_search_runs_out_of_budget_before_the_time_limit() -> None:
    steps = [
        DataStep(action="search_web", arguments={"query": f"вопрос {index}"}) for index in range(12)
    ]
    steps.extend(
        DataStep(
            action="finish", arguments={}, reason="Подтверждения в источниках нет", criteria=()
        )
        for _ in range(8)
    )
    explorer, _, _ = build(steps)
    explorer._web = cast(
        WebResearchPort, SimpleNamespace(search=AsyncMock(return_value=()), read=AsyncMock())
    )

    result = await explorer(
        "отель с телескопом на крыше",
        ("с телескопом на крыше",),
        "Казань",
        "russia",
        [hotel("city")],
        None,
        False,
    )

    assert cast(AsyncMock, explorer._web.search).await_count == 8
    assert result.wish_results[0].status is not WishStatus.MATCHED


def test_time_pressure_is_reported_once_per_threshold() -> None:
    warned: set[int] = set()

    assert time_notice(0.2, 140, warned) is None
    first = time_notice(0.65, 60, warned)
    assert first is not None and "Most of the time" in str(first["result"]["error"])
    assert time_notice(0.7, 50, warned) is None
    last = time_notice(0.9, 18, warned)
    assert last is not None and "almost over" in str(last["result"]["error"])
    assert last["result"]["remaining_seconds"] == 18
    assert time_notice(0.99, 2, warned) is None


async def test_unfinished_check_may_end_early_but_keeps_its_honest_status() -> None:
    steps = [
        *(
            DataStep(action="search_web", arguments={"query": f"попытка {index}"})
            for index in range(3)
        ),
        DataStep(
            action="finish",
            arguments={},
            reason="В проверенных источниках подтверждения нет",
            criteria=(),
        ),
    ]
    explorer, llm, _ = build(steps)
    explorer._web = cast(
        WebResearchPort, SimpleNamespace(search=AsyncMock(return_value=()), read=AsyncMock())
    )
    with patch(
        "hotel_agent.application.agent.wish_loop.time_notice",
        side_effect=lambda spent, left, warned: warned.add(85) or None,
    ):
        result = await explorer(
            "отель с телескопом", ("с телескопом",), "Сочи", "sochi", [hotel("city")], None, False
        )

    assert result.wish_results[0].status is WishStatus.INCOMPLETE
    assert "подтверждения нет" in result.wish_results[0].reason
    assert llm.explore_data.await_count == 4
