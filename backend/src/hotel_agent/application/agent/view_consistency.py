from dataclasses import replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.exploration_requests import represented_fragment


def reconcile_views(outcomes: list[ExplorationOutcome]) -> list[ExplorationOutcome]:
    terms = {
        intent.characteristic_key: intent.source_text
        for outcome in outcomes
        for intent in outcome.intents
    }
    geometry = [
        fact
        for outcome in outcomes
        for fact in outcome.facts
        if fact.method == "window_visibility@1" and fact.value is not True
    ]
    reconciled = []
    for outcome in outcomes:
        facts = []
        changed_terms = set()
        for fact in outcome.facts:
            term = terms.get(fact.characteristic_key, "")
            related = [
                native
                for native in geometry
                if native.hotel_id == fact.hotel_id
                and represented_fragment(
                    terms.get(native.characteristic_key, "").casefold(), term.casefold()
                )
            ]
            if fact.value is True and fact.method != "window_visibility@1" and related:
                native = next((row for row in related if row.value is False), related[0])
                fact = replace(
                    native,
                    id=fact.id,
                    characteristic_key=fact.characteristic_key,
                    qualifiers={**native.qualifiers, "source_text": term},
                )
                changed_terms.add(term)
            facts.append(fact)
        results = []
        unresolved = set()
        for result in outcome.wish_results:
            if result.term in changed_terms:
                matched = tuple(
                    dict.fromkeys(
                        fact.hotel_id
                        for fact in facts
                        if fact.value is True and terms.get(fact.characteristic_key) == result.term
                    )
                )
                result = replace(result, matched_hotel_ids=matched)
                if not matched:
                    unresolved.add(result.term)
                    result = replace(
                        result, status=WishStatus.INCOMPLETE, reason="window_geometry_not_confirmed"
                    )
            results.append(result)
        reconciled.append(
            replace(
                outcome,
                facts=tuple(facts),
                wish_results=tuple(results),
                resolved_terms=tuple(
                    term for term in outcome.resolved_terms if term not in unresolved
                ),
            )
        )
    return reconciled
