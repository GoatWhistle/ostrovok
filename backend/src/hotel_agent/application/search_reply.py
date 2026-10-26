from hotel_agent.application.agent.chat_answer_review import safe_answer
from hotel_agent.application.agent.wish_response import wish_response
from hotel_agent.application.use_cases.search_hotels import SearchOutcome
from hotel_agent.domain.services.scoring import MatchQuality


def search_reply(search: SearchOutcome, selected_hotel_id: str | None, locale: str) -> str:
    if not search.parsed.location_hint and not search.parsed.anywhere:
        if locale == "en":
            return "Which city should I search in?"
        return "В каком городе ищете отель?"
    if search.parsed.unsupported_region:
        if locale == "en":
            return f"I could not locate {search.parsed.unsupported_region} in the hotel data. Please clarify the city."
        return f"Не нашёл город «{search.parsed.unsupported_region}» в данных об отелях. Уточните название города."
    if search.review and search.review.unavailable:
        return room_question(search, safe_answer(search, locale), locale)
    if search.question:
        return room_question(search, search.question, locale)
    if search.parsed.needs_clarification:
        if locale == "en":
            return "Please clarify your request: some conditions conflict."
        return "Уточните условия: в запросе есть противоречие."
    count = len(search.results)
    if count == 0:
        if search.parsed.anywhere:
            wishes = ", ".join(
                dict.fromkeys(
                    (
                        *search.parsed.unmatched_terms,
                        *(intent.source_text for intent in search.parsed.intents),
                    )
                )
            )
            if locale == "en":
                return room_question(
                    search,
                    f"I searched the loaded Russian hotel catalog without a city restriction. I could not verify your wishes{': ' + wishes if wishes else ''}. This does not establish that such hotels do not exist elsewhere.",
                    locale,
                )
            return room_question(
                search,
                f"Искал без ограничения по городу в загруженном каталоге России. Пока не нашёл данных, подтверждающих ваши пожелания{': ' + wishes if wishes else ''}. Это не означает, что таких отелей не существует в других странах или источниках.",
                locale,
            )
        if locale == "en":
            answer = "I could not find hotels with a verified match. Try changing the conditions."
            return room_question(search, answer, locale)
        answer = "Пока не нашёл отелей с подтверждённым совпадением. Уточните или измените условия."
        return room_question(search, answer, locale)
    if selected_hotel_id:
        selected = next(
            (item for item in search.results if item.hotel.id == selected_hotel_id), None
        )
        if selected:
            if locale == "en":
                answer = f"I applied your update. {selected.hotel.name} remains in the list. Showing {count} hotels."
                return room_question(search, answer, locale)
            answer = f"Учёл уточнение. «{selected.hotel.name}» остаётся в подборке. Показываю {count} отелей."
            return room_question(search, answer, locale)
    names = ", ".join(item.hotel.name for item in search.results[:3])
    if locale == "en":
        answer = f"Showing {count} hotels. First in the list: {names}. Select a hotel to explore its surroundings."
        return room_question(search, answer, locale)
    answer = f"Показываю {count} отелей. Первые в подборке: {names}. Выберите отель, чтобы изучить его и окружение."
    return room_question(search, answer, locale)


def room_question(search: SearchOutcome, answer: str, locale: str) -> str:
    answer = wish_response(answer, search.wish_results, locale)
    parsed = search.parsed
    if (
        parsed.intents
        and search.results
        and not any(
            all(match.quality is MatchQuality.FULL for match in result.scored.matches)
            for result in search.results
        )
    ):
        if locale == "en":
            answer += " No hotel has every condition verified; these are the closest matches."
        else:
            answer += " Ни у одного отеля не подтверждены все условия; это ближайшие совпадения."
    if parsed.unmatched_terms:
        terms = ", ".join(parsed.unmatched_terms[:6])
        if locale == "en":
            answer += f" I could not verify: {terms}. These conditions did not affect the ranking."
        else:
            answer += f" Не смог проверить: {terms}. Эти условия не учтены в подборке."
    if not parsed.wants_room or parsed.room_preferences_unrestricted:
        return answer
    missing = []
    if parsed.check_in is None:
        missing.append("check-in date" if locale == "en" else "дату заезда")
    if parsed.check_out is None:
        missing.append("check-out date" if locale == "en" else "дату выезда")
    if parsed.adults is None:
        missing.append("number of adults" if locale == "en" else "число взрослых")
    if parsed.budget is None:
        missing.append(
            "budget per night or for the whole stay"
            if locale == "en"
            else "бюджет за ночь или за всё проживание"
        )
    if not missing:
        return answer
    fields = ", ".join(missing)
    if locale == "en":
        return f"{answer} To check room availability, please tell me the {fields}."
    return f"{answer} Чтобы проверить свободные номера, уточните {fields}."
