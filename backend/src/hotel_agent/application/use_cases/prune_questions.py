from dataclasses import dataclass
from datetime import timedelta

from hotel_agent.application import hotelier_events
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record
from hotel_agent.domain.characteristics import Scope
from hotel_agent.domain.entities import QuestionStatus

DEMAND_WINDOW_DAYS = 14
DEMAND_LIMIT = 20_000


@dataclass(frozen=True, slots=True, kw_only=True)
class PruneReport:
    backed: int = 0
    unbacked: int = 0
    deferred: int = 0
    reopened: int = 0
    applied: bool = False


class PruneHotelierQuestions:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        clock: ClockPort,
        window_days: int = DEMAND_WINDOW_DAYS,
    ) -> None:
        self._uow, self._registry, self._clock = uow, registry, clock
        self._window_days = window_days

    async def __call__(self, region: str, apply: bool = False) -> PruneReport:
        keys = sorted(
            item.key
            for item in self._registry.all()
            if item.ask_hotelier_if_missing and item.scope is Scope.HOTEL
        )
        if not keys:
            return PruneReport()
        now = self._clock.now()
        since = now - timedelta(days=self._window_days)
        async with self._uow() as uow:
            demand = await uow.demand.unknown_counts(region, keys, since, DEMAND_LIMIT)
            backed = sorted(
                {(item.hotel_id, item.characteristic_key) for item in demand if item.blocked > 0}
            )
            if not backed:
                return PruneReport()
            blocked = {(item.hotel_id, item.characteristic_key): item.blocked for item in demand}
            unbacked = await uow.questions.open_without_demand(region, keys, backed)
            waiting = await uow.questions.deferred_with_demand(region, backed)
            if not apply:
                return PruneReport(
                    backed=len(backed), unbacked=len(unbacked), deferred=len(waiting)
                )
            deferred = await uow.questions.set_statuses(unbacked, QuestionStatus.SKIPPED.value)
            reopened = await uow.questions.set_statuses(
                [record.id for record in waiting], QuestionStatus.OPEN.value
            )
            await hotelier_events.announce(
                uow.notifications,
                tuple(
                    hotelier_events.question_opened(
                        question_from_record(record),
                        now,
                        blocked.get((record.hotel_id, record.characteristic_key), 0),
                    )
                    for record in waiting
                ),
            )
            await uow.commit()
        return PruneReport(
            backed=len(backed),
            unbacked=len(unbacked),
            deferred=deferred,
            reopened=reopened,
            applied=True,
        )
