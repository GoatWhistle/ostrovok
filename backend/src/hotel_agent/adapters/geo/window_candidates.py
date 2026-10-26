from collections.abc import Mapping, Sequence
from dataclasses import replace
from itertools import islice, zip_longest

from shapely.geometry import shape

from hotel_agent.adapters.geo.building_dimensions import building_dimensions
from hotel_agent.adapters.geo.facade_observers import facade_observers
from hotel_agent.adapters.geo.window_targets import WindowTargets, target_point, target_points
from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.ports.view_geometry import PhysicalObject, ViewGeometryPort
from hotel_agent.application.ports.view_scenes import SceneBuilding
from hotel_agent.application.ports.window_views import PreparedViews, WindowRay
from hotel_agent.application.spatial_matching import distance_m
from hotel_agent.domain.query import SpatialRequest


class WindowCandidates:
    def __init__(self, geometry: ViewGeometryPort) -> None:
        self._targets = WindowTargets(geometry)
        self._geometry = geometry

    async def prepare(
        self,
        hotels: Sequence[SearchHotelRecord],
        request: SpatialRequest,
        targets: Mapping[str, NamedPlaceRecord | tuple[float, float]],
        buildings: Mapping[str, SceneBuilding],
    ) -> PreparedViews:
        groups: list[list[WindowRay]] = []
        reasons: dict[str, str] = {}
        rejected: list[str] = []
        unchecked: list[str] = []
        physical: dict[str, tuple[PhysicalObject, ...]] = {}
        resolved_targets: dict[str, PhysicalObject | None] = {}
        for candidate_target in targets.values():
            identifier = (
                candidate_target.id
                if isinstance(candidate_target, NamedPlaceRecord)
                else str(candidate_target)
            )
            if identifier not in resolved_targets:
                resolved_targets[identifier] = await self._targets.resolve(candidate_target)

        def proximity(hotel: SearchHotelRecord) -> float:
            target = targets.get(hotel.id)
            if target is None:
                return float("inf")
            identifier = target.id if isinstance(target, NamedPlaceRecord) else str(target)
            resolved = resolved_targets[identifier]
            point = (
                target_point(resolved, hotel.location)[0]
                if resolved is not None
                else target.location
                if isinstance(target, NamedPlaceRecord)
                else target
            )
            return distance_m(hotel.location, point)

        selected = sorted(hotels, key=proximity)
        for candidate_index, hotel in enumerate(selected):
            if candidate_index >= 64:
                unchecked.append(hotel.id)
                reasons[hotel.id] = (
                    "Этот кандидат ещё не проверен: достигнут лимит геометрических расчётов поиска."
                )
                continue
            target = targets.get(hotel.id)
            own = buildings.get(hotel.id)
            footprint = (
                dict(own.geometry) if own else dict(hotel.footprint) if hotel.footprint else None
            )
            if target is None:
                reasons[hotel.id] = (
                    "Не найден сам ориентир для проверки вида. Уточните его название или место."
                )
                continue
            tags = own.tags if own else {}
            if footprint is None and hotel.id.startswith(("w", "r")):
                recovered = await self._geometry.object(hotel.id)
                if recovered is not None and recovered.geometry["type"] in {
                    "Polygon",
                    "MultiPolygon",
                }:
                    footprint, tags = recovered.geometry, recovered.tags
            if footprint is None:
                reasons[hotel.id] = (
                    "Неизвестен контур здания отеля: невозможно определить положение окна."
                )
                continue
            dimensions = building_dimensions(tags, hotel.height_m, hotel.levels)
            if not shape(footprint).is_valid:
                reasons[hotel.id] = (
                    "Контур здания содержит ошибку геометрии: положение окна не подтверждено."
                )
                continue
            if (
                dimensions.height is not None
                and dimensions.height.maximum_m is not None
                and dimensions.levels is not None
                and dimensions.height.maximum_m < dimensions.levels * 2
            ):
                reasons[hotel.id] = (
                    "Высота здания противоречит указанной этажности: положение окна не подтверждено."
                )
                continue
            lower = request.floor_min or 1
            upper = request.floor_max or dimensions.levels or lower
            if lower > upper or (dimensions.levels is not None and lower > dimensions.levels):
                rejected.append(hotel.id)
                reasons[hotel.id] = (
                    "Запрошенный этаж отсутствует в известных данных об этажности здания."
                )
                continue
            if request.floor_max is not None and dimensions.levels is not None:
                upper = min(upper, dimensions.levels)
            if dimensions.levels is None and lower > 1:
                reasons[hotel.id] = (
                    "Неизвестна этажность здания: запрошенный этаж подтвердить невозможно."
                )
                continue
            identifier = target.id if isinstance(target, NamedPlaceRecord) else str(target)
            if identifier not in physical:
                resolved = resolved_targets[identifier]
                if resolved is not None and request.target_osm_key is not None:
                    value = resolved.tags.get(request.target_osm_key)
                    if value is None or (
                        request.target_osm_values and value not in request.target_osm_values
                    ):
                        resolved = None
                parts = await self._targets.parts(resolved) if resolved is not None else ()
                if request.target_component_key:
                    parts = tuple(
                        part
                        for part in parts
                        if part.tags.get(request.target_component_key) is not None
                        and (
                            not request.target_component_values
                            or part.tags[request.target_component_key]
                            in request.target_component_values
                        )
                    )
                physical[identifier] = tuple(
                    replace(
                        part,
                        tags={
                            **part.tags,
                            **(
                                {
                                    f"view:parent:{key}": value
                                    for key, value in resolved.tags.items()
                                }
                                if resolved
                                else {}
                            ),
                            "name": resolved.tags.get("name", request.target or "Море")
                            if resolved
                            else request.target or "Море",
                            "view:parent": resolved.id if resolved else part.id,
                        },
                    )
                    for part in parts
                )
            objectives = physical[identifier]
            if not objectives:
                reasons[hotel.id] = (
                    "Не получена геометрия запрошенной части ориентира: вид на другую часть её не заменяет."
                    if request.target_component_key
                    else "Не получена геометрия ориентира из источника: вид нельзя заменить расстоянием."
                )
                continue
            choices = (
                (objectives[0].id,)
                if request.target_part == "top"
                else tuple(objective.id for objective in objectives)
            )
            hotel_rays: list[WindowRay] = []
            found_observer = False
            for objective in objectives:
                if objective.id not in choices:
                    continue
                for position, height in target_points(
                    objective, hotel.location, top=request.target_part == "top"
                ):
                    if distance_m(hotel.location, position) > request.radius_m:
                        reasons[hotel.id] = (
                            "Ориентир находится за пределами запрошенной области проверки вида."
                        )
                        continue
                    observers = facade_observers(
                        footprint, hotel.location, position, request.facade_azimuth_deg
                    )
                    found_observer = found_observer or bool(observers)
                    for observer in observers[:3]:
                        if len(hotel_rays) < 216:
                            hotel_rays.append(
                                WindowRay(
                                    f"{hotel.id}:{len(hotel_rays)}",
                                    hotel.id,
                                    observer,
                                    dimensions,
                                    objective,
                                    position,
                                    height,
                                    tuple(range(lower, upper + 1)),
                                )
                            )
            if hotel_rays:
                by_target: dict[str, list[WindowRay]] = {}
                for ray in hotel_rays:
                    by_target.setdefault(ray.target.id, []).append(ray)
                for samples in by_target.values():
                    samples.sort(key=lambda ray: -ray.target_height.minimum_m)
                groups.append(
                    [
                        ray
                        for batch in zip_longest(*by_target.values())
                        for ray in batch
                        if ray is not None
                    ]
                )
            if not found_observer and hotel.id not in reasons:
                rejected.append(hotel.id)
                reasons[hotel.id] = (
                    "С запрошенной стороны здания ориентир не попадает в поле зрения окна."
                )
        rays = islice(
            (ray for batch in zip_longest(*groups) for ray in batch if ray is not None), 216
        )
        return PreparedViews(
            request, tuple(hotels), tuple(rays), reasons, tuple(rejected), tuple(unchecked)
        )
