from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from hotel_agent.application import hotelier_events
from hotel_agent.application.dto import DemandRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.notifications import Notification

EXPIRY_LEAD_DAYS = 14
DEMAND_WINDOW_DAYS = 14
BATCH = 500


@dataclass(frozen=True, slots=True, kw_only=True)
class SweepReport:
    expiring: int = 0
    demand: int = 0
    written: int = 0


class SweepHotelierNotifications:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        clock: ClockPort,
        lead_days: int = EXPIRY_LEAD_DAYS,
        window_days: int = DEMAND_WINDOW_DAYS,
        limit: int = BATCH,
    ) -> None:
        self._uow, self._registry, self._clock = uow, registry, clock
        self._lead_days, self._window_days, self._limit = lead_days, window_days, limit

    async def __call__(self, region: str) -> SweepReport:
        now = self._clock.now()
        keys = [item.key for item in self._registry.all()]
        askable = [item.key for item in self._registry.all() if item.ask_hotelier_if_missing]
        horizon = now + timedelta(days=self._lead_days)
        since = now - timedelta(days=self._window_days)
        async with self._uow() as uow:
            expiring = await uow.search.expiring_facts(region, keys, horizon, self._limit)
            demand = await uow.demand.unknown_counts(region, askable, since, self._limit)
            items = [
                *(hotelier_events.fact_expiring(record, now) for record in expiring),
                *self._demand(demand, now),
            ]
            written = await hotelier_events.announce(uow.notifications, items)
            await uow.commit()
        return SweepReport(expiring=len(expiring), demand=len(demand), written=written)

    def _demand(self, records: Sequence[DemandRecord], now: datetime) -> tuple[Notification, ...]:
        return tuple(
            hotelier_events.search_demand(
                record.hotel_id,
                record.characteristic_key,
                blocked_searches=record.blocked,
                appearances=record.appearances,
                window_days=self._window_days,
                now=now,
            )
            for record in records
        )
