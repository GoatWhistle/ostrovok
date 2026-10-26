from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.entities import Fact, FactStatus
from hotel_agent.domain.errors import HotelNotFound, InvalidQuery
from hotel_agent.domain.services.conflict_resolver import resolve
from hotel_agent.domain.value_objects import ConflictId


@dataclass(frozen=True, slots=True, kw_only=True)
class ComparisonRow:
    hotel_id: str
    cells: dict[str, Fact]


@dataclass(frozen=True, slots=True, kw_only=True)
class Comparison:
    characteristic_keys: tuple[str, ...]
    rows: tuple[ComparisonRow, ...]


class CompareHotels:
    def __init__(
        self, uow: UnitOfWorkFactory, registry: CharacteristicRegistryPort, clock: ClockPort
    ) -> None:
        self._uow = uow
        self._registry = registry
        self._clock = clock

    async def __call__(
        self, hotel_ids: Sequence[str], characteristic_keys: Sequence[str] | None = None
    ) -> Comparison:
        if not 2 <= len(hotel_ids) <= 5:
            raise InvalidQuery("Choose between two and five hotels")
        ids = tuple(dict.fromkeys(hotel_ids))
        async with self._uow() as uow:
            hotels = await uow.search.by_ids(ids)
            if set(ids) != {hotel.id for hotel in hotels}:
                raise HotelNotFound()
            records = await uow.search.list_facts(None, hotel_ids=ids)
        grouped: dict[tuple[str, str], list[Fact]] = defaultdict(list)
        for record in records:
            fact = fact_from_record(record)
            if fact.status not in {FactStatus.SUPERSEDED, FactStatus.COMPUTING}:
                grouped[(record.hotel_id, fact.characteristic_key)].append(fact)
        keys = (
            tuple(dict.fromkeys(characteristic_keys))
            if characteristic_keys is not None
            else tuple(sorted({key for _, key in grouped}))
        )
        tolerances = {item.key: item.conflict_tolerance for item in self._registry.all()}
        now = self._clock.now()
        rows = []
        for hotel_id in ids:
            cells = {}
            for key in keys:
                facts = grouped.get((hotel_id, key), [])
                if facts:
                    cells[key] = resolve(
                        sorted(facts, key=lambda fact: str(fact.id)),
                        now,
                        tolerances.get(key, 0),
                        ConflictId(f"compare:{hotel_id}:{key}"),
                    ).winner
            rows.append(ComparisonRow(hotel_id=hotel_id, cells=cells))
        return Comparison(characteristic_keys=keys, rows=tuple(rows))
