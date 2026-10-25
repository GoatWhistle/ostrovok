from collections.abc import Sequence

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


async def save_search_evidence(
    uow_factory: UnitOfWorkFactory, records: Sequence[SearchFactRecord], hotel_ids: Sequence[str]
) -> None:
    selected = [r for r in records if r.hotel_id in hotel_ids]
    if selected:
        async with uow_factory() as uow:
            await uow.search.save_facts(selected)
            await uow.commit()
