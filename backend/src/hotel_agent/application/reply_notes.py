from hotel_agent.application.agent.wish_response import wish_response
from hotel_agent.application.use_cases.search_hotels import SearchOutcome
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality

GUEST_KEYS = frozenset({"room_capacity"})


def listing(items: list[str], locale: str) -> str:
    if len(items) < 2:
        return "".join(items)
    joiner = " and " if locale == "en" else " и "
    return ", ".join(items[:-1]) + joiner + items[-1]


def compose_reply(
    search: SearchOutcome, lead: str | None, locale: str, question: str | None = None
) -> str:
    parts = [lead.strip()] if lead else []
    notes = wish_response("", search.wish_results, locale).strip()
    if notes:
        parts.append(notes)
    partial = partial_note(search, locale)
    if partial:
        parts.append(partial)
    unverified = unverified_note(search.parsed, locale)
    if unverified:
        parts.append(unverified)
    ask = question.strip() if question else room_ask(search.parsed, locale)
    if ask:
        parts.append(ask)
    return " ".join(parts)


def partial_note(search: SearchOutcome, locale: str) -> str | None:
    if not search.parsed.intents or not search.results:
        return None
    if any(
        all(match.quality is MatchQuality.FULL for match in result.scored.matches)
        for result in search.results
    ):
        return None
    if locale == "en":
        return "No hotel has every condition verified yet, so these are the closest matches."
    return "Ни у одного отеля пока не подтверждены все условия, поэтому показываю самые близкие."


def unverified_note(parsed: ParsedQuery, locale: str) -> str | None:
    if not parsed.unmatched_terms:
        return None
    terms = ", ".join(parsed.unmatched_terms[:6])
    if locale == "en":
        return f"I couldn't verify {terms}, so it didn't affect the ranking."
    return f"Не смог проверить: {terms}. На подборку это не влияло."


def guests_given(parsed: ParsedQuery) -> bool:
    return any(intent.characteristic_key in GUEST_KEYS for intent in parsed.intents)


def room_ask(parsed: ParsedQuery, locale: str) -> str | None:
    stay = parsed.wants_room or parsed.adults is not None or guests_given(parsed)
    if not stay or parsed.room_preferences_unrestricted:
        return None
    en = locale == "en"
    missing: list[str] = []
    if parsed.check_in is None and parsed.check_out is None:
        missing.append("your dates" if en else "даты поездки")
    elif parsed.check_in is None:
        missing.append("the check-in date" if en else "дату заезда")
    elif parsed.check_out is None:
        missing.append("the check-out date" if en else "дату выезда")
    if parsed.adults is None and not guests_given(parsed):
        missing.append("how many guests" if en else "сколько вас")
    if parsed.budget is None:
        missing.append("your budget" if en else "бюджет")
    if not missing:
        return None
    fields = listing(missing, locale)
    if en:
        return f"To check free rooms, could you share {fields}?"
    return f"Чтобы проверить свободные номера, подскажите {fields}?"
