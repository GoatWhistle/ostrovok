from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from hotel_agent.application.dto import (
    ConflictRecord,
    NotificationCounters,
    SearchHotelRecord,
)
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record
from hotel_agent.application.use_cases.hotelier_questions import characteristic_weight
from hotel_agent.domain.characteristics import Characteristic
from hotel_agent.domain.entities import Fact, FactStatus, HotelierQuestion, QuestionStatus
from hotel_agent.domain.errors import HotelNotFound
from hotel_agent.domain.services.hotelier_attention import (
    ActionKind,
    Attention,
    first_attention,
    question_priority,
)
from hotel_agent.domain.services.hotelier_coverage import Coverage, coverage

DEMAND_WINDOW_DAYS = 14
EXPIRY_LEAD_DAYS = 14
QUEUE_SIZE = 20
LIVE_STATUSES = frozenset({FactStatus.ACTIVE, FactStatus.STALE, FactStatus.CONFIRMED_BY_HOTELIER})

UNKNOWN = "unknown"
DISPUTED = "disputed"
STALE = "stale"
CONFIRMED = "confirmed"
KNOWN = "known"


@dataclass(frozen=True, slots=True, kw_only=True)
class QueuedQuestion:
    question: HotelierQuestion
    blocked_searches: int
    priority: float


@dataclass(frozen=True, slots=True, kw_only=True)
class CharacteristicState:
    key: str
    title: str
    state: str
    askable: bool
    blocked_searches: int
    appearances: int
    fact: Fact | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class CabinetOverview:
    hotel: SearchHotelRecord
    coverage: Coverage
    unread: NotificationCounters
    appearances: int
    window_days: int
    questions: tuple[QueuedQuestion, ...]
    conflicts: tuple[ConflictRecord, ...]
    expiring: tuple[Fact, ...]
    characteristics: tuple[CharacteristicState, ...]
    next_action: Attention | None


class GetHotelierCabinet:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        clock: ClockPort,
        window_days: int = DEMAND_WINDOW_DAYS,
        lead_days: int = EXPIRY_LEAD_DAYS,
    ) -> None:
        self._uow, self._registry, self._clock = uow, registry, clock
        self._window_days, self._lead_days = window_days, lead_days

    async def __call__(self, hotel_id: str) -> CabinetOverview:
        now = self._clock.now()
        since = now - timedelta(days=self._window_days)
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            rows = await uow.search.list_facts(None, hotel_id, (hotel_id,))
            conflicts = tuple(await uow.facts.conflicts(hotel_id))
            questions = tuple(
                question_from_record(record) for record in await uow.questions.for_hotel(hotel_id)
            )
            unread = await uow.notifications.unread_counts(hotel_id)
            demand = await uow.demand.for_hotel(hotel_id, since)
            appearances = await uow.demand.appearances(hotel_id, since)
        blocked = {item.characteristic_key: item.blocked for item in demand}
        seen = {item.characteristic_key: item.appearances for item in demand}
        facts = tuple(fact_from_record(row) for row in rows if row.hotel_id == hotel_id)
        disputed = {item.characteristic_key for item in conflicts}
        known = self._registry.all()
        weights = {item.key: characteristic_weight(item) for item in known}
        queue = self._queue(questions, blocked, weights, now)
        expiring = self._expiring(facts, now)
        return CabinetOverview(
            hotel=hotel,
            coverage=coverage([item.key for item in known], facts, disputed, now),
            unread=unread,
            appearances=appearances,
            window_days=self._window_days,
            questions=queue,
            conflicts=conflicts,
            expiring=expiring,
            characteristics=self._states(known, facts, disputed, blocked, seen, now),
            next_action=first_attention(self._attention(conflicts, queue, expiring, blocked)),
        )

    def _queue(
        self,
        questions: Sequence[HotelierQuestion],
        blocked: Mapping[str, int],
        weights: Mapping[str, float],
        now: datetime,
    ) -> tuple[QueuedQuestion, ...]:
        ranked = [
            QueuedQuestion(
                question=item,
                blocked_searches=blocked.get(item.characteristic_key, 0),
                priority=question_priority(
                    reason=item.reason,
                    blocked_searches=blocked.get(item.characteristic_key, 0),
                    characteristic_weight=weights.get(item.characteristic_key, 1.0),
                    opened_at=item.created_at,
                    now=now,
                ),
            )
            for item in questions
            if item.status is QuestionStatus.OPEN
        ]
        ranked.sort(key=lambda item: (-item.priority, str(item.question.id)))
        return tuple(ranked[:QUEUE_SIZE])

    def _expiring(self, facts: Sequence[Fact], now: datetime) -> tuple[Fact, ...]:
        horizon = now + timedelta(days=self._lead_days)
        rows = [
            fact
            for fact in facts
            if fact.status in LIVE_STATUSES
            and fact.provenance.valid_until is not None
            and fact.provenance.valid_until <= horizon
        ]
        rows.sort(key=lambda fact: (fact.provenance.valid_until or horizon, str(fact.id)))
        return tuple(rows)

    def _states(
        self,
        known: Sequence[Characteristic],
        facts: Sequence[Fact],
        disputed: set[str],
        blocked: Mapping[str, int],
        seen: Mapping[str, int],
        now: datetime,
    ) -> tuple[CharacteristicState, ...]:
        current = {
            fact.characteristic_key: fact
            for fact in facts
            if fact.status is not FactStatus.SUPERSEDED
        }
        return tuple(
            CharacteristicState(
                key=item.key,
                title=item.title_ru,
                state=_state(current.get(item.key), item.key in disputed, now),
                askable=item.ask_hotelier_if_missing,
                blocked_searches=blocked.get(item.key, 0),
                appearances=seen.get(item.key, 0),
                fact=current.get(item.key),
            )
            for item in known
        )

    def _attention(
        self,
        conflicts: Sequence[ConflictRecord],
        queue: Sequence[QueuedQuestion],
        expiring: Sequence[Fact],
        blocked: Mapping[str, int],
    ) -> tuple[Attention, ...]:
        return (
            *(
                Attention(
                    kind=ActionKind.RESOLVE_CONFLICT,
                    reference=item.id,
                    characteristic_key=item.characteristic_key,
                    blocked_searches=blocked.get(item.characteristic_key, 0),
                )
                for item in conflicts
                if item.resolution == "pending"
            ),
            *(
                Attention(
                    kind=ActionKind.ANSWER_QUESTION,
                    reference=str(item.question.id),
                    characteristic_key=item.question.characteristic_key,
                    blocked_searches=item.blocked_searches,
                )
                for item in queue
            ),
            *(
                Attention(
                    kind=ActionKind.RECONFIRM_VALUE,
                    reference=str(item.id),
                    characteristic_key=item.characteristic_key,
                    blocked_searches=blocked.get(item.characteristic_key, 0),
                )
                for item in expiring
                if item.status is FactStatus.CONFIRMED_BY_HOTELIER
            ),
        )


def _state(fact: Fact | None, disputed: bool, now: datetime) -> str:
    if fact is None or fact.value is None:
        return UNKNOWN
    if disputed:
        return DISPUTED
    if fact.is_stale_at(now):
        return STALE
    if fact.status is FactStatus.CONFIRMED_BY_HOTELIER:
        return CONFIRMED
    return KNOWN
