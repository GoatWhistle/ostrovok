from collections.abc import Callable, Iterable
from itertools import batched

from hotel_agent.application.ports.geography import GeographyUnitOfWork, HotelTags


class RefreshHotelTags:
    def __init__(self, uow: Callable[[], GeographyUnitOfWork]) -> None:
        self._uow = uow

    async def __call__(self, records: Iterable[HotelTags]) -> int:
        count = 0
        for batch in batched(records, 1000):
            async with self._uow() as uow:
                count += await uow.geography.merge_hotel_tags(batch)
                await uow.commit()
        return count
