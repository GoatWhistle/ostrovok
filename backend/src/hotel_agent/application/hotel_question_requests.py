from dataclasses import dataclass
from datetime import datetime

from hotel_agent.application.dto import QuestionRecord, SearchFactRecord
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.domain.characteristics import SourceType

OWNER_ANSWER_LIMIT = 600


@dataclass(frozen=True, slots=True)
class OwnerAnswer:
    characteristic_key: str
    text: str
    observed_at: datetime


@dataclass(frozen=True, slots=True)
class HotelQuestions:
    sent: tuple[str, ...] = ()
    answered: tuple[OwnerAnswer, ...] = ()


def _fresh(item: SearchFactRecord, now: datetime) -> bool:
    return (
        item.status in {"active", "confirmed_by_hotelier"}
        and item.confidence >= 0.7
        and (item.valid_until is None or item.valid_until > now)
    )


def _owner_answer(key: str, fresh: list[SearchFactRecord]) -> OwnerAnswer | None:
    answers = [
        item
        for item in fresh
        if item.source_type == SourceType.HOTELIER.value and item.explanation.strip()
    ]
    if not answers:
        return None
    latest = max(answers, key=lambda item: item.observed_at or item.computed_at)
    return OwnerAnswer(
        characteristic_key=key,
        text=" ".join(latest.explanation.split())[:OWNER_ANSWER_LIMIT],
        observed_at=latest.observed_at or latest.computed_at,
    )


async def enqueue_hotel_questions(
    work: UnitOfWork,
    registry: CharacteristicRegistryPort,
    now: datetime,
    hotel_id: str,
    requested: tuple[str, ...],
) -> HotelQuestions:
    allowed = {
        item.key: item
        for item in registry.all()
        if item.ask_hotelier_if_missing and SourceType.HOTELIER in item.source_kinds
    }
    keys = tuple(key for key in dict.fromkeys(requested) if key in allowed)[:8]
    if not keys:
        return HotelQuestions()
    hotel = await work.search.get_hotel(hotel_id)
    if hotel is None:
        return HotelQuestions()
    await work.facts.lock_hotel(hotel_id)
    pending = []
    sent = []
    answered = []
    for key in keys:
        versions = await work.facts.versions("hotel", hotel_id, key)
        fresh = [item for item in versions if _fresh(item, now)]
        if fresh:
            known = _owner_answer(key, fresh)
            if known is not None:
                answered.append(known)
            continue
        characteristic = allowed[key]
        identifier = f"q_{hotel_id}_{key}"
        existing = await work.questions.get(identifier)
        if existing is not None:
            if existing.status != "open":
                await work.questions.set_status(identifier, "open")
        else:
            pending.append(
                QuestionRecord(
                    id=identifier,
                    hotel_id=hotel_id,
                    characteristic_key=key,
                    text=(characteristic.question_template or characteristic.title_ru).format(
                        hotel=hotel.name
                    ),
                    reason="stale" if versions else "missing",
                    status="open",
                    created_at=now,
                )
            )
        sent.append(key)
    if pending:
        await work.questions.add(pending)
    return HotelQuestions(sent=tuple(sent), answered=tuple(answered))


def owner_reply(questions: HotelQuestions, locale: str) -> str:
    english = locale == "en"
    lines = [
        (
            f"The hotel owner answered on {item.observed_at:%Y-%m-%d}: “{item.text}”"
            if english
            else f"Ответ владельца отеля от {item.observed_at:%d.%m.%Y}: «{item.text}»"
        )
        for item in questions.answered
    ]
    if questions.sent:
        lines.append(
            "There is no such information about the hotel yet. We have passed your question to "
            "the hotel owner; their reply will appear in the hotel card."
            if english
            else "Таких данных об отеле пока нет. Передали ваш вопрос владельцу отеля — его ответ "
            "появится в карточке."
        )
    return "\n\n".join(lines)


def owner_notes(questions: HotelQuestions, locale: str) -> str:
    english = locale == "en"
    notes = [
        (
            f"The hotel owner answered on {item.observed_at:%Y-%m-%d}: “{item.text}”"
            if english
            else f"Ответ владельца отеля от {item.observed_at:%d.%m.%Y}: «{item.text}»"
        )
        for item in questions.answered
    ]
    if questions.sent:
        notes.append(
            "Your question has been sent to the hotel owner. Their reply will appear in the hotel card."
            if english
            else "Вопрос отправлен владельцу отеля. Его ответ появится в карточке."
        )
    return "".join(f"\n\n{note}" for note in notes)
