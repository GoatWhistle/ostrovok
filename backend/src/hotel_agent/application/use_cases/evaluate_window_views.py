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
        initial = await self._evaluate(hotels, request, targets, now)
        if len(hotels) <= 8 or any(fact.value is True for fact in initial.facts):
            return initial
        candidates = []
        by_id = {hotel.id: hotel for hotel in hotels}
        for fact in initial.facts:
            visibility = fact.qualifiers.get("visibility", {})
            distance = visibility.get("distance_m")
            if (
                visibility.get("calculation_attempted")
                and isinstance(distance, (float, int))
                and fact.hotel_id in by_id
            ):
                candidates.append((float(distance), fact.hotel_id))
        selected = tuple(by_id[identifier] for _, identifier in sorted(candidates)[:8])
        if not selected:
            return initial
        refined = await self._evaluate(selected, request, targets, now)
        facts = {fact.hotel_id: fact for fact in initial.facts}
        facts.update({fact.hotel_id: fact for fact in refined.facts})
        features = {feature.id: feature for feature in (*initial.features, *refined.features)}
        return WindowEvidence(tuple(facts.values()), tuple(features.values()))

    async def _evaluate(
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
