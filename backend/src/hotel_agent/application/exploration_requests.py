from dataclasses import replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.domain.query import ParsedQuery


def exploration_terms(parsed: ParsedQuery) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            (
                *parsed.unmatched_terms,
                *(request.source_text for request in parsed.facility_requests),
            )
        )
    )


def apply_exploration(parsed: ParsedQuery, explored: ExplorationOutcome) -> ParsedQuery:
    return replace(
        parsed,
        intents=tuple(
            intent for intent in parsed.intents if intent.source_text not in explored.resolved_terms
        )
        + explored.intents,
        unmatched_terms=tuple(
            term for term in parsed.unmatched_terms if term not in explored.resolved_terms
        ),
        needs_clarification=False,
    )
