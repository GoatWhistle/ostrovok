import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion, DataStep
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_research import PlaceResearchPort, PlaceResearchResult
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from tests.unit.application.test_research_tools import HOTEL

NOW = datetime(2026, 10, 26, 9, tzinfo=UTC)
TERM = "рядом джазовый концерт 27 октября"
ARGUMENTS = {
    "hotel_ids": ["h1"],
    "query": "джаз",
    "term": TERM,
    "radius_m": 2000,
    "check_in": "2026-10-27T00:00:00+03:00",
    "check_out": "2026-10-28T00:00:00+03:00",
}
EVENT = {
    "title": "Джазовый концерт",
    "description": "Живой концерт джазового квартета",
    "location": (39.721, 43.581),
    "source_url": "https://kudago.com/event/jazz/",
    "start": "2026-10-27T20:00:00+03:00",
    "end": "2026-10-27T22:00:00+03:00",
    "distance_m": 150,
    "status": "unknown",
    "is_free": None,
}


def verdicts(context: str, supported: bool = True) -> list[EvidenceVerdict]:
    records = json.loads(context)["records"]
    return [
        EvidenceVerdict(record_id=r["record_id"], supported=supported, quote=r["source_text"])
        for r in records
    ]


def tools(provider: Any, supported: bool = True) -> tuple[DataTools, SimpleNamespace]:
    llm = SimpleNamespace(verify_evidence=AsyncMock(side_effect=lambda c: verdicts(c, supported)))
    instance = DataTools(
        MagicMock(),
        MagicMock(),
        [HOTEL],
        "Сочи",
        "russia",
        None,
        False,
        evidence=DocumentEvidence(cast(LLMPort, llm), (TERM,)),
        terms=(TERM,),
        now=NOW,
        places={"search_events": provider, "measure_landcover": provider},
    )
    return instance, llm


@pytest.mark.parametrize("supported", [True, False])
async def test_event_evidence_propagates_quote_source_and_venue_only_when_verified(
    supported: bool,
) -> None:
    provider = SimpleNamespace(
        research=AsyncMock(return_value=PlaceResearchResult(records=(EVENT,)))
    )
    instance, llm = tools(provider, supported)
    result = await instance.execute("search_events", ARGUMENTS)
    assert bool(result["fields"]) == supported
    criterion = DataCriterion(
        term=TERM,
        source_text=TERM,
        checks=(DataCheck(field="event1.match_count", op="gte", value=1),),
        required=False,
        explanation="",
    )
    outcome = materialize(TERM, (TERM,), (criterion,), instance, NOW, None)
    assert bool(outcome.facts) == supported
    if supported:
        fact = outcome.facts[0]
        assert fact.value is True
        assert fact.qualifiers["source_urls"] == [EVENT["source_url"]]
        assert fact.qualifiers["source_quotes"]
        assert fact.geo_refs == ("g_point_39.721000_43.581000",)
        assert "2026-10-27" in fact.explanation
    assert "requested_start" in llm.verify_evidence.call_args.args[0]


async def test_missing_provider_and_upstream_failure_leave_metrics_unknown() -> None:
    instance, _ = tools(
        SimpleNamespace(research=AsyncMock(side_effect=ValueError("403 unavailable")))
    )
    result = await instance.execute("search_events", ARGUMENTS)
    assert result["errors"] and not instance.metrics
    result = await instance.execute("observe_wildlife", {"query": "Pica pica"})
    assert "error" in result and not instance.metrics


@pytest.mark.parametrize(
    "changes",
    [
        {"radius_m": float("nan")},
        {"hotel_ids": ["unknown"]},
        {"check_in": "2026-10-27"},
        {"check_out": "2026-12-27T00:00:00+03:00"},
    ],
)
async def test_invalid_scope_never_calls_provider(changes: dict[str, Any]) -> None:
    provider = SimpleNamespace(research=AsyncMock())
    instance, _ = tools(provider)
    with pytest.raises((ValueError, TypeError)):
        await instance.execute("search_events", {**ARGUMENTS, **changes})
    provider.research.assert_not_called()


async def test_landcover_metrics_have_provenance_and_bounded_hotel_selection() -> None:
    provider = SimpleNamespace(
        research=AsyncMock(
            return_value=PlaceResearchResult(
                descriptions={
                    "trees_sample_pct": "ESA WorldCover 2021, доля точек, не вид из окна"
                },
                values={"trees_sample_pct": 80},
                sources=("https://worldcover2021.esa.int/",),
                points=(HOTEL.location,),
            )
        )
    )
    instance, _ = tools(provider)
    result = await instance.execute("measure_landcover", {"radius_m": 500})
    assert result["fields"]["place1.trees_sample_pct"].startswith("ESA WorldCover 2021")
    assert instance.metrics["h1"]["place1.trees_sample_pct"] == 80
    assert instance.research.sources["h1"]["place1.trees_sample_pct"] == (
        "https://worldcover2021.esa.int/",
    )


async def test_explorer_calls_new_tool_and_verifies_event_scope_before_fact() -> None:
    provider = SimpleNamespace(
        research=AsyncMock(return_value=PlaceResearchResult(records=(EVENT,)))
    )
    llm = SimpleNamespace(
        explore_data=AsyncMock(
            side_effect=[
                DataStep(action="search_events", arguments=ARGUMENTS),
                DataStep(
                    action="finish",
                    arguments={},
                    criteria=(
                        DataCriterion(
                            term=TERM,
                            source_text=TERM,
                            checks=(DataCheck(field="event1.match_count", op="gte", value=1),),
                            required=False,
                            explanation="",
                        ),
                    ),
                ),
            ]
        ),
        verify_evidence=AsyncMock(side_effect=verdicts),
    )

    @asynccontextmanager
    async def uow() -> AsyncIterator[Any]:
        yield SimpleNamespace(data=SimpleNamespace(records=AsyncMock(return_value=[])))

    explorer = DataExplorer(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, uow),
        MagicMock(),
        cast(ClockPort, SimpleNamespace(now=lambda: NOW)),
        MagicMock(),
        places={"search_events": cast(PlaceResearchPort, provider)},
    )
    outcome = await explorer(TERM, (TERM,), "Сочи", "russia", [HOTEL], None, False)
    assert outcome.resolved_terms == (TERM,)
    assert outcome.facts[0].value is True
    assert llm.verify_evidence.await_count == 2
    assert json.loads(llm.verify_evidence.call_args.args[0])["mode"] == "measurement_scope"
