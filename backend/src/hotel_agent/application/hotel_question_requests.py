from datetime import datetime

from hotel_agent.application.dto import QuestionRecord
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWork
from hotel_agent.domain.characteristics import SourceType


async def enqueue_hotel_questions(
    work: UnitOfWork,
    registry: CharacteristicRegistryPort,
    now: datetime,
    hotel_id: str,
    requested: tuple[str, ...],
) -> tuple[str, ...]:
    allowed = {
        item.key: item
        for item in registry.all()
        if item.ask_hotelier_if_missing and SourceType.HOTELIER in item.source_kinds
    }
    keys = tuple(key for key in dict.fromkeys(requested) if key in allowed)[:8]
    if not keys:
        return ()
    hotel = await work.search.get_hotel(hotel_id)
    if hotel is None:
        return ()
    await work.facts.lock_hotel(hotel_id)
    pending = []
    sent = []
    for key in keys:
        versions = await work.facts.versions("hotel", hotel_id, key)
        if any(
            item.status in {"active", "confirmed_by_hotelier"}
            and item.confidence >= 0.7
            and (item.valid_until is None or item.valid_until > now)
            for item in versions
        ):
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
    return tuple(sent)
