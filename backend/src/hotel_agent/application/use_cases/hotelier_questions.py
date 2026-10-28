from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from hotel_agent.application import hotelier_events
from hotel_agent.application.dto import QuestionCandidate
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record, question_to_record
from hotel_agent.domain.characteristics import Characteristic, Scope
from hotel_agent.domain.entities import HotelierQuestion, QuestionReason, QuestionStatus
from hotel_agent.domain.errors import HotelNotFound, InvalidValue, QuestionNotFound
from hotel_agent.domain.services.hotelier_attention import question_priority, worth_asking
from hotel_agent.domain.value_objects import HotelId, QuestionId

DEMAND_WINDOW_DAYS = 14
QUEUE_LIMIT = 200
COLD_START = 20


class ListHotelierQuestions:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(
        self, hotel_id: str, status: QuestionStatus | None = None
    ) -> tuple[HotelierQuestion, ...]:
        async with self._uow() as uow:
            if await uow.search.get_hotel(hotel_id) is None:
                raise HotelNotFound()
            records = await uow.questions.for_hotel(hotel_id)
        questions = tuple(question_from_record(record) for record in records)
        if status is None:
            return questions
        return tuple(item for item in questions if item.status is status)


class ChangeQuestionStatus:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, question_id: str, status: QuestionStatus) -> HotelierQuestion:
        if status is QuestionStatus.ANSWERED:
            raise InvalidValue("A question is answered only through its answer")
        async with self._uow() as uow:
            record = await uow.questions.get(question_id, lock=True)
            if record is None:
                raise QuestionNotFound()
            current = question_from_record(record)
            changed = current.reopened() if status is QuestionStatus.OPEN else current.skipped()
            if changed.status is not current.status:
                await uow.questions.set_status(question_id, changed.status.value)
                await uow.commit()
        return changed


@dataclass(frozen=True, slots=True, kw_only=True)
class Ranked:
    candidate: QuestionCandidate
    blocked: int
    priority: float


class PlanHotelierQuestions:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        clock: ClockPort,
        window_days: int = DEMAND_WINDOW_DAYS,
    ) -> None:
        self._uow, self._registry, self._clock = uow, registry, clock
        self._window_days = window_days

    async def __call__(
        self, region: str, limit: int = QUEUE_LIMIT, cold_start: int = COLD_START
    ) -> int:
        askable = {
            item.key: item
            for item in self._registry.all()
            if item.ask_hotelier_if_missing and item.scope is Scope.HOTEL
        }
        if not askable:
            return 0
        now = self._clock.now()
        keys = sorted(askable)
        async with self._uow() as uow:
            demand = await uow.demand.unknown_counts(
                region, keys, now - timedelta(days=self._window_days)
            )
            blocked = {(item.hotel_id, item.characteristic_key): item.blocked for item in demand}
            chosen: tuple[Ranked, ...] = ()
            if blocked:
                asked_about = sorted({item.hotel_id for item in demand})
                chosen = self._rank(
                    await uow.questions.candidates(
                        region, keys, asked_about, len(asked_about) * len(keys)
                    ),
                    askable,
                    blocked,
                    now,
                    limit,
                )
            elif cold_start > 0:
                chosen = self._rank(
                    await uow.questions.candidates(region, keys, None, cold_start),
                    askable,
                    blocked,
                    now,
                    cold_start,
                    gated=False,
                )
            questions = [self._question(item, askable, now) for item in chosen]
            added = await uow.questions.add([question_to_record(item) for item in questions])
            await hotelier_events.announce(
                uow.notifications,
                tuple(
                    hotelier_events.question_opened(question, now, item.blocked)
                    for question, item in zip(questions, chosen, strict=True)
                ),
            )
            await uow.commit()
        return added

    def _rank(
        self,
        candidates: Sequence[QuestionCandidate],
        askable: Mapping[str, Characteristic],
        blocked: Mapping[tuple[str, str], int],
        now: datetime,
        limit: int,
        gated: bool = True,
    ) -> tuple[Ranked, ...]:
        ranked: list[Ranked] = []
        for candidate in candidates:
            hits = blocked.get((candidate.hotel_id, candidate.characteristic_key), 0)
            if gated and not worth_asking(reason=QuestionReason.MISSING, blocked_searches=hits):
                continue
            ranked.append(
                Ranked(
                    candidate=candidate,
                    blocked=hits,
                    priority=question_priority(
                        reason=QuestionReason.MISSING,
                        blocked_searches=hits,
                        characteristic_weight=characteristic_weight(
                            askable[candidate.characteristic_key]
                        ),
                        opened_at=now,
                        now=now,
                    ),
                )
            )
        ranked.sort(
            key=lambda item: (
                -item.priority,
                item.candidate.hotel_id,
                item.candidate.characteristic_key,
            )
        )
        return tuple(ranked[:limit])

    def _question(
        self, item: Ranked, askable: Mapping[str, Characteristic], now: datetime
    ) -> HotelierQuestion:
        characteristic = askable[item.candidate.characteristic_key]
        return HotelierQuestion(
            id=QuestionId(f"q_{item.candidate.hotel_id}_{item.candidate.characteristic_key}"),
            hotel_id=HotelId(item.candidate.hotel_id),
            characteristic_key=item.candidate.characteristic_key,
            text=(characteristic.question_template or characteristic.title_ru).format(
                hotel=item.candidate.hotel_name
            ),
            reason=QuestionReason.MISSING,
            created_at=now,
        )


def characteristic_weight(item: Characteristic) -> float:
    return max((matcher.weight for matcher in item.matchers), default=1.0)
