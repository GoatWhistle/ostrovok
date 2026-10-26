from collections.abc import Callable, Mapping, Sequence
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory

DATASETS = ("hotels", "rooms", "facilities", "documents", "onsite_objects")


class SourceRecords:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        extra: Mapping[str, Callable[[], Sequence[dict[str, Any]]]],
    ) -> None:
        self._uow, self._hotels, self._extra = uow, hotels, extra
        self.retrieved: list[dict[str, Any]] = []
        self._cache: dict[tuple[str, tuple[str, ...]], Sequence[dict[str, Any]]] = {}

    async def read(self, dataset: str) -> Sequence[dict[str, Any]]:
        if dataset == "retrieved_documents":
            return self.retrieved
        if dataset in self._extra:
            return self._extra[dataset]()
        if dataset not in DATASETS:
            raise ValueError("Dataset is unavailable; inspect_data lists stored datasets")
        identity = (dataset, tuple(hotel.id for hotel in self._hotels()))
        if identity not in self._cache:
            async with self._uow() as uow:
                self._cache[identity] = await uow.data.records(dataset, identity[1])
        return self._cache[identity]
