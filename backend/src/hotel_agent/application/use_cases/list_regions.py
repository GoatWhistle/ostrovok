from collections.abc import Sequence

from hotel_agent.application.dto import RegionRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class ListRegions:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self) -> Sequence[RegionRecord]:
        async with self._uow() as uow:
            return await uow.regions.list_loaded()
