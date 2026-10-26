from dataclasses import replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.domain.query import ParsedQuery


def exploration_terms(parsed: ParsedQuery) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            term.strip()
            for term in (
                *(item.source_text for item in parsed.intents),
                *(item.source_text for item in parsed.nearby_objects),
                *(item.source_text for item in parsed.spatial_requests),
                *(item.source_text for item in parsed.facility_requests),
                *parsed.unmatched_terms,
                *parsed.wishes,
            )
            if term.strip()
        )
    )


def apply_exploration(parsed: ParsedQuery, explored: ExplorationOutcome) -> ParsedQuery:
    return replace(
        parsed,
        intents=tuple(
            intent
            for intent in parsed.intents
            if intent.source_text not in (*explored.resolved_terms, *explored.processed_terms)
        )
        + explored.intents,
        unmatched_terms=tuple(
            term
            for term in parsed.unmatched_terms
            if term not in (*explored.resolved_terms, *explored.processed_terms)
        ),
        needs_clarification=False,
    )
