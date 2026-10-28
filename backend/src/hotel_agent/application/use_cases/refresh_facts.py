from dataclasses import dataclass, replace
from datetime import datetime

from hotel_agent.application import hotelier_events
from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.fact_records import FactOwner, fact_from_record, fact_to_record
from hotel_agent.application.fact_versions import (
    conflict_record,
    current_versions,
    settle_answer,
)
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.precompute_sunset import KEY, PrecomputeSunset
from hotel_agent.domain.value_objects import ConflictId

KEYS = (KEY,)


@dataclass(frozen=True, slots=True, kw_only=True)
class RefreshReport:
    retired: int = 0
    checked: int = 0
    recomputed: int = 0
    changed: int = 0
    conflicts: int = 0


class RefreshStaleFacts:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        sunset: PrecomputeSunset,
        registry: CharacteristicRegistryPort,
        clock: ClockPort,
    ) -> None:
        self._uow, self._sunset, self._registry, self._clock = uow, sunset, registry, clock
        self._settled = 0

    async def __call__(self, region: str, limit: int = 500) -> RefreshReport:
        now = self._clock.now()
        async with self._uow() as uow:
            retired = await uow.facts.retire_expired(region, now)
            await uow.commit()
        async with self._uow() as uow:
            stale = await uow.search.stale_facts(region, KEYS, now, limit)
            hotels = await uow.search.by_ids([row.hotel_id for row in stale])
        known = {hotel.id: hotel for hotel in hotels}
        recomputed, changed, conflicts = 0, 0, 0
        for row in stale:
            hotel = known.get(row.hotel_id)
            if hotel is None:
                continue
            fresh = await self._sunset.fact(hotel, now)
            if fresh is None:
                continue
            recomputed += 1
            if fresh.value == row.value:
                await self._keep(fresh)
                continue
            changed += 1
            conflicts += await self._settle(replace(fresh, id=self._version(fresh, now)), row)
        return RefreshReport(
            retired=retired,
            checked=len(stale),
            recomputed=recomputed,
            changed=changed,
            conflicts=conflicts,
        )

    @staticmethod
    def _version(fresh: SearchFactRecord, now: datetime) -> str:
        return f"{fresh.id}_r{now:%Y%m%d%H%M%S}"

    async def _keep(self, fresh: SearchFactRecord) -> None:
        async with self._uow() as uow:
            await uow.facts.save([fresh])
            await uow.commit()

    async def _settle(self, fresh: SearchFactRecord, previous: SearchFactRecord) -> int:
        owner = FactOwner.of(fresh)
        tolerance = self._registry.get(fresh.characteristic_key).conflict_tolerance
        self._settled += 1
        async with self._uow() as uow:
            versions = await uow.facts.versions(
                owner.subject_type, owner.subject_id, fresh.characteristic_key
            )
            settlement = settle_answer(
                fact_from_record(fresh),
                current_versions(versions),
                self._clock.now(),
                tolerance,
                ConflictId(f"c_refresh_{self._settled}"),
            )
            await uow.facts.save([fact_to_record(item, owner) for item in settlement.writes])
            records = (
                (conflict_record(settlement.conflict, owner),)
                if settlement.conflict is not None
                else ()
            )
            await uow.facts.save_conflicts(records)
            now = self._clock.now()
            await hotelier_events.announce(
                uow.notifications,
                (
                    hotelier_events.fact_changed(previous, fresh, now),
                    *hotelier_events.conflicts_raised(records, fresh.hotel_id, now),
                ),
            )
            await uow.commit()
        return 0 if settlement.conflict is None else 1
