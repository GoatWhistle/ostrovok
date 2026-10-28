import re
from collections.abc import Sequence
from dataclasses import replace

from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.stay_question import GUEST_KEYS, GUEST_WORDS
from hotel_agent.domain.query import Intent, ParsedQuery

CAPACITY = "room_capacity"
DIGITS = re.compile(
    r"\b([1-9])\s*(?:-?[хx]\s*)?(взросл|чел|гост|adults?|people|persons?|guests?)", re.IGNORECASE
)
WORDS = (
    (re.compile(r"вдво[её]м|двоих|двое\b|двух\s+взросл|\btwo\b|\bcouple\b", re.IGNORECASE), 2),
    (re.compile(r"втро[её]м|троих|трое\b|тр[её]х\s+взросл|\bthree\b", re.IGNORECASE), 3),
    (re.compile(r"вчетвером|четверых|четверо\b|четыр[её]х\s+взросл|\bfour\b", re.IGNORECASE), 4),
    (re.compile(r"впятером|пятерых|пятеро\b|\bfive\b", re.IGNORECASE), 5),
)


def guest_count(text: str) -> int | None:
    if not GUEST_WORDS.search(text):
        return None
    digits = DIGITS.search(text)
    if digits:
        return int(digits.group(1))
    return next((count for pattern, count in WORDS if pattern.search(text)), None)


def guest_capacity(intent: Intent) -> bool:
    return intent.characteristic_key == CAPACITY and bool(GUEST_WORDS.search(intent.source_text))


def guest_phrase(text: str) -> bool:
    return bool(GUEST_WORDS.search(text))


def stay_guests(parsed: ParsedQuery) -> ParsedQuery:
    counts = [
        int(intent.value)
        for intent in parsed.intents
        if guest_capacity(intent) and isinstance(intent.value, int | float)
    ]
    texts = (
        *(intent.source_text for intent in parsed.intents),
        *parsed.wishes,
        *parsed.unmatched_terms,
    )
    counts.extend(count for count in map(guest_count, texts) if count is not None)
    adults = parsed.adults if parsed.adults is not None else next(iter(counts), None)
    if adults is None and not any(
        intent.characteristic_key in GUEST_KEYS for intent in parsed.intents
    ):
        return parsed
    return replace(
        parsed,
        adults=adults,
        intents=tuple(
            intent
            for intent in parsed.intents
            if not (
                intent.characteristic_key.startswith("derived:")
                and guest_phrase(intent.source_text)
            )
        ),
        wishes=tuple(wish for wish in parsed.wishes if not guest_phrase(wish)),
        unmatched_terms=tuple(term for term in parsed.unmatched_terms if not guest_phrase(term)),
    )


def researched(parsed: ParsedQuery) -> ParsedQuery:
    return replace(
        parsed, intents=tuple(intent for intent in parsed.intents if not guest_capacity(intent))
    )


async def catalog_capacity(
    uow: UnitOfWorkFactory, parsed: ParsedQuery, hotels: Sequence[SearchHotelRecord]
) -> tuple[ParsedQuery, tuple[SearchFactRecord, ...]]:
    if not any(guest_capacity(intent) for intent in parsed.intents):
        return parsed, ()
    facts: tuple[SearchFactRecord, ...] = ()
    if hotels:
        async with uow() as unit:
            facts = tuple(
                await unit.search.list_facts(
                    None, hotel_ids=[hotel.id for hotel in hotels], characteristic_keys=[CAPACITY]
                )
            )
    return (parsed, facts) if facts else (researched(parsed), ())
