from hotel_agent.application.agent.wish_response import wish_response
from hotel_agent.application.stay_question import stay_question
from hotel_agent.application.use_cases.search_hotels import SearchOutcome
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality


def listing(items: list[str], locale: str) -> str:
    if len(items) < 2:
        return "".join(items)
    joiner = " and " if locale == "en" else " и "
    return ", ".join(items[:-1]) + joiner + items[-1]


def compose_reply(
    search: SearchOutcome,
    lead: str | None,
    locale: str,
    question: str | None = None,
    partial: bool = True,
) -> str:
    parts = [lead.strip()] if lead else []
    notes = wish_response("", search.wish_results, locale).strip()
    if notes:
        parts.append(notes)
    closest = partial_note(search, locale) if partial else None
    if closest:
        parts.append(closest)
    unverified = unverified_note(search.parsed, locale)
    if unverified:
        parts.append(unverified)
    ask = question.strip() if question else stay_question(search.parsed, locale)
    if ask:
        parts.append(ask)
    return " ".join(parts)


def is_partial(search: SearchOutcome) -> bool:
    if not search.parsed.intents or not search.results:
        return False
    return not any(
        all(match.quality is MatchQuality.FULL for match in result.scored.matches)
        for result in search.results
    )


def partial_note(search: SearchOutcome, locale: str, cards: bool = False) -> str | None:
    if not is_partial(search):
        return None
    if locale == "en":
        tail = "; details are on the cards." if cards else "."
        return f"None has every condition verified yet, so these are the closest{tail}"
    tail = ", детали в карточках." if cards else "."
    return f"Все условия пока не подтверждены ни у одного, поэтому показываю самые близкие{tail}"


def unverified_note(parsed: ParsedQuery, locale: str) -> str | None:
    if not parsed.unmatched_terms:
        return None
    terms = ", ".join(parsed.unmatched_terms[:6])
    if locale == "en":
        return f"I couldn't verify {terms}, so it didn't affect the ranking."
    return f"Не смог проверить: {terms}. На подборку это не влияло."
