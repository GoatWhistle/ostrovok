from dataclasses import replace
from datetime import datetime

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCriterion, ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.measurement_scope import verify_measurement_scope
from hotel_agent.application.agent.wish_evidence import relabel_facts, wish_intent
from hotel_agent.application.ports.llm import LLMPort


async def evaluate_criteria(
    llm: LLMPort,
    query: str,
    term: str,
    criteria: tuple[DataCriterion, ...],
    tools: DataTools,
    now: datetime,
) -> tuple[ExplorationOutcome, tuple[str, ...]]:
    accepted, rejected = await verify_measurement_scope(llm, query, criteria, tools, now)
    candidate = materialize(query, (term,), accepted, tools, now, None)
    if candidate.intents:
        candidate = replace(
            candidate,
            facts=relabel_facts(term, candidate.facts),
            intents=(wish_intent(term, any(c.required for c in accepted)),),
        )
    return candidate, rejected
