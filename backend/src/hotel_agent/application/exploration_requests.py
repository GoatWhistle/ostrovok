from dataclasses import replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.domain.query import ParsedQuery


def exploration_terms(parsed: ParsedQuery) -> tuple[str, ...]:
    represented = tuple(
        text.strip()
        for text in (
            *(item.source_text for item in parsed.intents),
            *(item.source_text for item in parsed.nearby_objects),
            *(item.source_text for item in parsed.spatial_requests),
            *(item.source_text for item in parsed.facility_requests),
        )
        if text.strip()
    )
    wishes = (
        term
        for term in parsed.wishes
        if not any(represented_fragment(term.strip(), source) for source in represented)
    )
    return tuple(
        dict.fromkeys(
            term.strip()
            for term in (*represented, *parsed.unmatched_terms, *wishes)
            if term.strip()
        )
    )


def represented_fragment(fragment: str, source: str) -> bool:
    if not fragment:
        return False
    start = source.find(fragment)
    while start >= 0:
        end = start + len(fragment)
        if (start == 0 or not source[start - 1].isalnum()) and (
            end == len(source) or not source[end].isalnum()
        ):
            return True
        start = source.find(fragment, start + 1)
    return False


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
