from collections.abc import Sequence

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.entities import Fact


async def save_search_evidence(
    uow_factory: UnitOfWorkFactory, records: Sequence[SearchFactRecord], hotel_ids: Sequence[str]
) -> None:
    selected = [r for r in records if r.hotel_id in hotel_ids]
    if selected:
        async with uow_factory() as uow:
            await uow.search.save_facts(selected)
            await uow.commit()


def best_facts(rows: Sequence[SearchFactRecord]) -> dict[str, dict[str, Fact]]:
    grouped: dict[str, dict[str, Fact]] = {}
    for row in rows:
        current = grouped.setdefault(row.hotel_id, {})
        fact = fact_from_record(row)
        old = current.get(row.characteristic_key)
        if old is None or (
            row.characteristic_key == "noise_level"
            and isinstance(fact.value, int | float)
            and isinstance(old.value, int | float)
            and fact.value < old.value
        ):
            current[row.characteristic_key] = fact
    return grouped
