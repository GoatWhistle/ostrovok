from collections.abc import Mapping, Sequence
from datetime import datetime

from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.window_views import WindowEvidence, WindowViewsPort
from hotel_agent.domain.query import SpatialRequest


class EvaluateWindowViews:
    def __init__(self, uow: UnitOfWorkFactory, views: WindowViewsPort) -> None:
        self._uow, self._views = uow, views

    async def __call__(
        self,
        hotels: Sequence[SearchHotelRecord],
        request: SpatialRequest,
        targets: Mapping[str, NamedPlaceRecord | tuple[float, float]],
        now: datetime,
    ) -> WindowEvidence:
        async with self._uow() as uow:
            own = await uow.view_scenes.hotel_buildings([hotel.id for hotel in hotels])
        prepared = await self._views.prepare(hotels, request, targets, own)
        paths = {ray.id: (ray.observer.location, ray.target_location) for ray in prepared.rays}
        async with self._uow() as uow:
            buildings = await uow.view_scenes.path_buildings(paths)
        return await self._views.evaluate(prepared, buildings, now)
