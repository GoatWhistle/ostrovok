from collections.abc import Callable, Mapping
from dataclasses import replace
from datetime import datetime, timedelta

from hotel_agent.application import hotelier_events
from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.fact_records import FactOwner, fact_from_record, fact_to_record
from hotel_agent.application.fact_values import checked_value
from hotel_agent.application.fact_versions import (
    conflict_record,
    current_versions,
    retire,
    settle_answer,
    settled_by_hotelier,
)
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWork, UnitOfWorkFactory
from hotel_agent.domain.characteristics import Characteristic, SourceType, ValueType
from hotel_agent.domain.entities import Fact, FactStatus, FactValue
from hotel_agent.domain.errors import FactNotFound, InvalidValue
from hotel_agent.domain.value_objects import (
    Confidence,
    ConflictId,
    Evidence,
    EvidenceKind,
    FactId,
    Provenance,
    SourceRef,
)

MAX_COMMENT_LENGTH = 10_000


class ChangeFacts:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        clock: ClockPort,
        next_id: Callable[[str], str],
    ) -> None:
        self._uow, self._registry, self._clock, self._next_id = uow, registry, clock, next_id

    async def confirm(self, fact_id: str) -> Fact:
        async with self._uow() as uow:
            record = await _locked(uow, fact_id)
            fact = fact_from_record(record)
            if fact.status is FactStatus.SUPERSEDED:
                raise InvalidValue("A superseded fact cannot be confirmed")
            if fact.status is FactStatus.COMPUTING:
                raise InvalidValue("A computing fact has no value to confirm")
            if fact.status is FactStatus.CONFIRMED_BY_HOTELIER:
                return fact
            now = self._clock.now()
            characteristic = self._registry.get(fact.characteristic_key)
            confirmed = replace(
                fact,
                status=FactStatus.CONFIRMED_BY_HOTELIER,
                provenance=replace(
                    fact.provenance,
                    computed_at=now,
                    valid_until=now + timedelta(days=characteristic.ttl_days),
                ),
            )
            await self._replace(uow, record, confirmed, ())
            await uow.commit()
            return confirmed

    async def correct(self, fact_id: str, value: object, comment: str) -> Fact:
        if len(comment) > MAX_COMMENT_LENGTH:
            raise InvalidValue("Comment must contain at most 10000 characters")
        async with self._uow() as uow:
            record = await _locked(uow, fact_id)
            old = fact_from_record(record)
            if old.status is FactStatus.SUPERSEDED:
                raise InvalidValue("Correct the current fact instead of a superseded fact")
            characteristic = self._registry.get(old.characteristic_key)
            checked = _checked(value, characteristic)
            now = self._clock.now()
            new = self._corrected(old, checked, comment, characteristic, now)
            await self._settle(uow, record, new, characteristic, now)
            await uow.commit()
            return new

    async def _settle(
        self,
        uow: UnitOfWork,
        record: SearchFactRecord,
        winner: Fact,
        characteristic: Characteristic,
        now: datetime,
    ) -> None:
        owner = FactOwner.of(record)
        versions = await uow.facts.versions(
            owner.subject_type, owner.subject_id, winner.characteristic_key
        )
        settlement = settle_answer(
            winner,
            current_versions(versions),
            now,
            characteristic.conflict_tolerance,
            ConflictId(self._next_id("c")),
        )
        await uow.facts.save([fact_to_record(item, owner) for item in settlement.writes])
        replaced = {str(item.id) for item in settlement.writes if item.id != winner.id}
        pending = await uow.facts.conflicts(owner.hotel_id)
        records = settled_by_hotelier(pending, replaced, str(winner.id))
        if settlement.conflict is not None:
            records = (*records, conflict_record(settlement.conflict, owner))
        await uow.facts.save_conflicts(records)
        await hotelier_events.announce(
            uow.notifications, hotelier_events.conflicts_raised(records, owner.hotel_id, now)
        )

    async def _replace(
        self,
        uow: UnitOfWork,
        record: SearchFactRecord,
        winner: Fact,
        retired: tuple[Fact, ...],
    ) -> None:
        owner = FactOwner.of(record)
        versions = await uow.facts.versions(
            owner.subject_type, owner.subject_id, winner.characteristic_key
        )
        others = retire(current_versions(versions, exclude=record.id), winner)
        writes = (*retired, *others, winner)
        await uow.facts.save([fact_to_record(item, owner) for item in writes])
        replaced = {record.id, *(str(item.id) for item in others)}
        conflicts = await uow.facts.conflicts(owner.hotel_id)
        settled = settled_by_hotelier(conflicts, replaced, str(winner.id))
        await uow.facts.save_conflicts(settled)
        await hotelier_events.announce(
            uow.notifications,
            hotelier_events.conflicts_raised(settled, owner.hotel_id, self._clock.now()),
        )

    def _corrected(
        self,
        old: Fact,
        value: FactValue,
        comment: str,
        characteristic: Characteristic,
        now: datetime,
    ) -> Fact:
        return replace(
            old,
            id=FactId(self._next_id("f")),
            value=value,
            status=FactStatus.CONFIRMED_BY_HOTELIER,
            explanation=comment,
            geo_refs=() if old.characteristic_key == "distance_to_sea" else old.geo_refs,
            qualifiers={
                key: item for key, item in value.items() if key != "allowed" and item is not None
            }
            if isinstance(value, Mapping)
            else old.qualifiers,
            provenance=Provenance(
                source=SourceRef(source_type=SourceType.HOTELIER),
                method="hotelier_correction@1",
                confidence=Confidence(1),
                computed_at=now,
                observed_at=now,
                valid_until=now + timedelta(days=characteristic.ttl_days),
                evidence=(Evidence(kind=EvidenceKind.QUOTE, text=comment),) if comment else (),
            ),
        )


async def _locked(uow: UnitOfWork, fact_id: str) -> SearchFactRecord:
    record = await uow.facts.get(fact_id)
    if record is None:
        raise FactNotFound()
    await uow.facts.lock_hotel(record.hotel_id)
    locked = await uow.facts.get(fact_id, lock=True)
    if locked is None:
        raise FactNotFound()
    return locked


def _checked(value: object, characteristic: Characteristic) -> FactValue:
    checked = checked_value(value, characteristic.value_type)
    if isinstance(checked, Mapping) and characteristic.fields:
        rules = {field.name: field for field in characteristic.fields}
        for key, item in checked.items():
            if key not in rules:
                raise InvalidValue("Unknown characteristic field")
            if item is not None:
                nested = checked_value(item, ValueType(rules[key].kind.value))
                if isinstance(nested, float) and nested < 0:
                    raise InvalidValue("Value must be nonnegative")
    if isinstance(checked, float) and checked < 0:
        raise InvalidValue("Value must be nonnegative")
    return checked
