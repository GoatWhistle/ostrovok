import re
from dataclasses import replace

from hotel_agent.domain.query import ParsedQuery

GUEST_KEYS = frozenset({"room_capacity", "guests", "adults"})
GUEST_WORDS = re.compile(
    r"(вдво[её]м|вдвоем|двоих|троих|четверых|пятерых|с\s+реб[её]нк|взросл"
    r"|for\s+(two|three|four|2|3|4)\b|couple|adults?\b|\b[1-9]\s*(чел|people|persons?))",
    re.IGNORECASE,
)

QUESTIONS = {
    "dates": ("What dates are you travelling?", "На какие даты едете?"),
    "check_in": ("What is your check-in date?", "С какого числа заезд?"),
    "check_out": ("Until what date are you staying?", "До какого числа остаётесь?"),
    "guests": ("How many of you are travelling?", "Сколько вас будет?"),
    "budget": ("What budget per night do you have in mind?", "Какой бюджет на ночь?"),
}


def guests_given(parsed: ParsedQuery) -> bool:
    if parsed.adults is not None:
        return True
    if any(intent.characteristic_key in GUEST_KEYS for intent in parsed.intents):
        return True
    texts = (
        parsed.normalized_query or "",
        *parsed.wishes,
        *parsed.unmatched_terms,
        *(intent.source_text for intent in parsed.intents),
    )
    return any(GUEST_WORDS.search(text) for text in texts)


def missing_slot(parsed: ParsedQuery) -> str | None:
    if parsed.check_in is None and parsed.check_out is None:
        return "dates"
    if parsed.check_in is None:
        return "check_in"
    if parsed.check_out is None:
        return "check_out"
    if not guests_given(parsed):
        return "guests"
    if parsed.budget is None:
        return "budget"
    return None


def stay_question(parsed: ParsedQuery, locale: str) -> str | None:
    stay = parsed.wants_room or guests_given(parsed)
    if not stay or parsed.room_preferences_unrestricted:
        return None
    slot = missing_slot(parsed)
    if slot is None:
        return None
    english, russian = QUESTIONS[slot]
    return english if locale == "en" else russian


def without_guest_wishes(parsed: ParsedQuery) -> ParsedQuery:
    known = parsed.adults is not None or any(
        intent.characteristic_key in GUEST_KEYS for intent in parsed.intents
    )
    if not known:
        return parsed
    return replace(
        parsed,
        intents=tuple(
            intent
            for intent in parsed.intents
            if not (
                intent.characteristic_key.startswith("derived:")
                and GUEST_WORDS.search(intent.source_text)
            )
        ),
        wishes=tuple(wish for wish in parsed.wishes if not GUEST_WORDS.search(wish)),
        unmatched_terms=tuple(
            term for term in parsed.unmatched_terms if not GUEST_WORDS.search(term)
        ),
    )
