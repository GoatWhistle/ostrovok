import json
import re
from typing import Any

from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode

SEARCH = re.compile(
    r"\b(?:найди\w*|подбери\w*|ищу|ищем|поищи\w*|найти|подобрать|search|find|show|looking)\b"
)
HOTEL = re.compile(r"отел\w*|гостиниц\w*|номер\w*|hotel\w*|room\w*")
WANT = re.compile(
    r"\b(?:хочу|хотим|нужен|нужна|нужно|нужны|посоветуй|порекомендуй|want|need|recommend)\b"
)
QUESTION = re.compile(
    r"^(?:как\b|что\b|чем\b|почему\b|когда\b|зачем\b|расскажи\b|объясни\b|какие\b|какой\b|какая\b|есть\b|what\b|how\b|when\b)"
)
UPDATE = re.compile(
    r"^(?:а (?:теперь|в |можно)|покажи (?:друг|дешев|ещё|еще)|ещ[её] (?:тиш|дешев)|дешевле|поближе|только |без |лучше |вместо |любой город|где угодно|мне не важен город)"
)


def respond(context: str) -> ChatDecision:
    data = json.loads(context)
    message = str(data["message"]).strip()
    normalized = message.casefold().replace("ё", "е")
    previous = data.get("previous_search_query")
    history = data.get("history", [])
    last = (
        str(history[-1].get("content", ""))
        if history and history[-1].get("role") == "assistant"
        else ""
    )
    english = data.get("locale") == "en"
    informative = bool(QUESTION.search(normalized))
    declined = bool(re.search(r"\bне (?:ищ|надо|нужно|подбир|подбер|показыв|запускай)", normalized))
    explicit = (
        not informative
        and not declined
        and bool(
            SEARCH.search(normalized) or (WANT.search(normalized) and HOTEL.search(normalized))
        )
    )
    standalone = bool(
        not declined
        and HOTEL.search(normalized)
        and not QUESTION.search(normalized)
        and "?" not in normalized
    )
    referring = bool(re.search(r"(?:в нем|в нём|у него|в этом|об этом|о нем|о нём)", normalized))
    continuing = bool(
        previous
        and UPDATE.search(normalized)
        and not referring
        and not declined
        and not informative
    )
    pending = bool(
        previous
        and (
            data.get("needs_city")
            or re.search(
                r"в каком городе|which city|уточните.*(?:дат|гост|бюджет)", last.casefold()
            )
        )
        and len(message.split()) <= 8
        and "?" not in message
        and not QUESTION.search(normalized)
        and not re.search(r"\b(?:привет|спасибо|нет|hello|thanks|thank)\b", normalized)
    )
    if explicit or (standalone and not data.get("selected_hotel")) or continuing or pending:
        fresh = bool(re.search(r"новый поиск|начни заново|new search", normalized))
        query = f"{previous}; {message}" if previous and not fresh else message
        return ChatDecision(ChatMode.SEARCH, query=query)
    hotel = data.get("selected_hotel")
    if hotel and not re.search(r"^(?:привет|спасибо|hello|thanks|thank you)[!. ]*$", normalized):
        return ChatDecision(ChatMode.HOTEL, reply=_hotel_reply(hotel, english))
    if re.search(r"^(?:спасибо|thanks|thank you)", normalized):
        reply = (
            "You're welcome. I can help you compare options or understand hotel details."
            if english
            else "Пожалуйста! Могу помочь разобраться в условиях проживания или выборе отеля."
        )
    elif QUESTION.search(normalized):
        reply = (
            "Consider your dates, transport, room requirements and cancellation policy. What would you like to discuss?"
            if english
            else "При выборе учитывайте даты поездки, транспорт, условия номера и отмены. Какой вопрос разобрать подробнее?"
        )
    else:
        reply = (
            "Hello! I can advise on hotels and travel. What would you like to know?"
            if english
            else "Здравствуйте! Могу подсказать по выбору отеля и поездке. Что хотите узнать?"
        )
    return ChatDecision(ChatMode.CONSULT, reply=reply)


def _hotel_reply(hotel: dict[str, Any], english: bool) -> str:
    if hotel.get("unavailable"):
        return (
            "The selected hotel's details are unavailable. Please select a hotel again."
            if english
            else "Данные выбранного отеля недоступны. Выберите его ещё раз."
        )
    name = str(hotel.get("name", ""))
    rooms = hotel.get("rooms", [])
    facts = hotel.get("facts", [])
    details = [str(f.get("explanation", "")) for f in facts[:3] if f.get("explanation")]
    if rooms:
        details.append(
            ("Rooms in inventory: " if english else "Номера в инвентаризации: ")
            + ", ".join(str(r.get("name", "")) for r in rooms[:3])
        )
    prefix = (
        f"Available information about {name}: "
        if english
        else f"Доступные сведения об отеле «{name}»: "
    )
    missing = (
        "No further verified details are available."
        if english
        else "Дополнительных подтверждённых сведений пока нет."
    )
    suffix = (
        " Inventory does not confirm availability for your dates. Ask the hotel to confirm any missing details."
        if english
        else " Инвентаризация не подтверждает наличие на ваши даты. Недостающие сведения стоит уточнить у отеля."
    )
    return prefix + ("; ".join(details) if details else missing) + suffix
