from hotel_agent.application.agent.chat_answer_review import safe_answer
from hotel_agent.application.reply_notes import compose_reply, hotels_en, hotels_ru, listing
from hotel_agent.application.use_cases.search_hotels import SearchOutcome


def search_reply(search: SearchOutcome, selected_hotel_id: str | None, locale: str) -> str:
    en = locale == "en"
    parsed = search.parsed
    if not parsed.location_hint and not parsed.anywhere:
        return "Which city should I search in?" if en else "В каком городе ищете отель?"
    if parsed.unsupported_region:
        if en:
            return f"I couldn't find {parsed.unsupported_region} in the hotel data. Which city do you mean?"
        return f"Не нашёл «{parsed.unsupported_region}» в данных об отелях. Какой город вы имеете в виду?"
    if search.question:
        return compose_reply(search, None, locale, search.question)
    if search.review and search.review.unavailable:
        return compose_reply(search, safe_answer(search, locale), locale)
    if parsed.needs_clarification:
        if en:
            return "Some of the conditions contradict each other. Which one matters more?"
        return "Часть условий противоречит друг другу. Что из этого важнее?"
    if not search.results:
        return compose_reply(search, empty_lead(search, locale), locale)
    return compose_reply(search, found_lead(search, selected_hotel_id, locale), locale)


def empty_lead(search: SearchOutcome, locale: str) -> str:
    en = locale == "en"
    if not search.parsed.anywhere:
        if en:
            return "I couldn't find hotels where the data confirms your conditions. Try relaxing one of them."
        return "Не нашёл отелей, где данные подтверждают ваши условия. Попробуйте смягчить одно из них."
    wishes = ", ".join(
        dict.fromkeys(
            (
                *search.parsed.unmatched_terms,
                *(intent.source_text for intent in search.parsed.intents),
            )
        )
    )
    if en:
        about = f" for {wishes}" if wishes else ""
        return f"I searched the whole Russian catalog and found no confirmation{about}. That doesn't mean such hotels don't exist, only that our data doesn't show them."
    about = f": {wishes}" if wishes else ""
    return f"Искал по всему каталогу России и не нашёл подтверждений{about}. Это не значит, что таких отелей нет, просто в наших данных их не видно."


def found_lead(search: SearchOutcome, selected_hotel_id: str | None, locale: str) -> str:
    en = locale == "en"
    count = len(search.results)
    total = hotels_en(count) if en else hotels_ru(count)
    selected = next(
        (item for item in search.results if item.hotel.id == selected_hotel_id), None
    )
    if selected:
        if en:
            return f"Got it. {selected.hotel.name} is still on the list, {total} in total."
        return f"Учёл. «{selected.hotel.name}» остаётся в подборке, всего {total}."
    names = listing([item.hotel.name for item in search.results[:3]], locale)
    if count == 1:
        return f"Found one hotel: {names}." if en else f"Нашёл один отель: {names}."
    if en:
        return f"Found {total}. Closest to your request: {names}."
    return f"Нашёл {total}. Ближе всего к запросу: {names}."
