import re
from dataclasses import dataclass, replace

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.domain.query import ParsedQuery

WORD = re.compile(r"[^\W\d_]+")
STEM = 4
GENERIC = {
    "отель",
    "отеля",
    "гостиница",
    "гостиницу",
    "гостиницы",
    "номер",
    "апартаменты",
    "хостел",
    "жильё",
    "найди",
    "найти",
    "ищу",
    "хочу",
    "нужен",
    "нужна",
    "нужно",
    "подбери",
    "посоветуй",
    "забронируй",
    "остановиться",
    "пожить",
    "hotel",
    "room",
    "stay",
    "find",
    "need",
    "want",
}
FUNCTION = {
    "в",
    "во",
    "на",
    "с",
    "со",
    "и",
    "или",
    "а",
    "но",
    "где",
    "который",
    "для",
    "по",
    "из",
    "до",
    "у",
    "о",
    "об",
    "от",
    "к",
    "ко",
    "при",
    "за",
    "что",
    "чтобы",
    "как",
    "это",
    "там",
    "же",
    "бы",
    "я",
    "мне",
    "меня",
    "мы",
    "нам",
    "его",
    "её",
    "их",
    "то",
    "так",
    "сам",
    "сама",
    "сами",
}


@dataclass(frozen=True, slots=True)
class ExplorationPlan:
    terms: tuple[str, ...] = ()
    duplicates: tuple[str, ...] = ()


def stems(text: str) -> list[str]:
    return [word[:STEM] for word in WORD.findall(text.casefold().replace("ё", "е"))]


def condition_key(term: str, framing: set[str]) -> frozenset[str]:
    return frozenset(stems(term)) - framing


def exploration_plan(parsed: ParsedQuery) -> ExplorationPlan:
    framing = {word[:STEM] for word in (*GENERIC, *FUNCTION)}
    framing |= set(stems(parsed.location_hint or ""))
    kept: dict[frozenset[str], str] = {}
    duplicates: list[str] = []
    for term in exploration_terms(parsed):
        key = condition_key(term, framing)
        previous = kept.get(key)
        if previous is None:
            kept[key] = term
            continue
        focused = min((previous, term), key=lambda item: (len(stems(item)), len(item)))
        duplicates.append(previous if focused == term else term)
        kept[key] = focused
    order = {term: index for index, term in enumerate(exploration_terms(parsed))}
    return ExplorationPlan(
        tuple(sorted(kept.values(), key=lambda term: order[term])), tuple(duplicates)
    )


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


def apply_exploration(
    parsed: ParsedQuery, explored: ExplorationOutcome, duplicates: tuple[str, ...] = ()
) -> ParsedQuery:
    covered = (*explored.resolved_terms, *explored.processed_terms, *duplicates)
    return replace(
        parsed,
        intents=tuple(intent for intent in parsed.intents if intent.source_text not in covered)
        + explored.intents,
        unmatched_terms=tuple(term for term in parsed.unmatched_terms if term not in covered),
        needs_clarification=False,
    )


def merge_exploration(first: ExplorationOutcome, retried: ExplorationOutcome) -> ExplorationOutcome:
    hotels = {row.id: row for row in (*first.hotels, *retried.hotels)}
    facts = {(row.hotel_id, row.characteristic_key): row for row in (*first.facts, *retried.facts)}
    intents = {item.characteristic_key: item for item in (*first.intents, *retried.intents)}
    features = {row.id: row for row in (*first.features, *retried.features)}
    wishes = {item.term: item for item in (*first.wish_results, *retried.wish_results)}
    return ExplorationOutcome(
        hotels=tuple(hotels.values()),
        bbox=retried.bbox or first.bbox,
        intents=tuple(intents.values()),
        facts=tuple(facts.values()),
        resolved_terms=tuple(dict.fromkeys((*first.resolved_terms, *retried.resolved_terms))),
        processed_terms=tuple(dict.fromkeys((*first.processed_terms, *retried.processed_terms))),
        features=tuple(features.values()),
        wish_results=tuple(wishes.values()),
        question=retried.question or first.question,
    )
