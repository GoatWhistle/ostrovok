from collections.abc import Sequence

from hotel_agent.application.dto import GeoFeatureRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class GetGeoFeatures:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, ids: Sequence[str]) -> Sequence[GeoFeatureRecord]:
        async with self._uow() as uow:
            return await uow.geo_features.get_batch(ids)
