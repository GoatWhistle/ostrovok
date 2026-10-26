import asyncio
from collections.abc import Mapping, Sequence
from datetime import datetime

from hotel_agent.adapters.geo.window_candidates import WindowCandidates
from hotel_agent.adapters.geo.window_reports import WindowReport, window_evidence
from hotel_agent.adapters.geo.window_scene import (
    base_elevation,
    corridor_cells,
    obstacles,
    scene_samples,
)
from hotel_agent.application.dto import (
    GeoFeatureRecord,
    NamedPlaceRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.ports.elevation import ElevationPort
from hotel_agent.application.ports.view_geometry import PhysicalArea, ViewGeometryPort
from hotel_agent.application.ports.view_scenes import PathBuildings, SceneBuilding
from hotel_agent.application.ports.window_views import PreparedViews, WindowEvidence
from hotel_agent.domain.query import SpatialRequest
from hotel_agent.domain.visibility import ElevationRange, sightline


class WindowViews:
    def __init__(self, terrain: ElevationPort, geometry: ViewGeometryPort) -> None:
        self._terrain, self._geometry = terrain, geometry
        self._candidates = WindowCandidates(geometry)
        self._downloads = asyncio.Semaphore(4)

    async def prepare(
        self,
        hotels: Sequence[SearchHotelRecord],
        request: SpatialRequest,
        targets: Mapping[str, NamedPlaceRecord | tuple[float, float]],
        buildings: Mapping[str, SceneBuilding],
    ) -> PreparedViews:
        return await self._candidates.prepare(hotels, request, targets, buildings)

    async def evaluate(
        self, prepared: PreparedViews, buildings: PathBuildings, now: datetime
    ) -> WindowEvidence:
        cell_sets = {ray.id: corridor_cells(ray) for ray in prepared.rays}
        all_cells = tuple(dict.fromkeys(cell for cells in cell_sets.values() for cell in cells))

        async def load(
            cell: tuple[float, float, float, float],
        ) -> tuple[tuple[float, float, float, float], PhysicalArea | None]:
            async with self._downloads:
                return cell, await self._geometry.area(cell)

        areas = dict(await asyncio.gather(*(load(cell) for cell in all_cells[:128])))
        reports: dict[str, WindowReport] = {}
        reasons = dict(prepared.reasons)
        for ray in prepared.rays:
            rows = {row.id: row for row in buildings.buildings.get(ray.id, ())}
            for cell in cell_sets[ray.id]:
                area = areas.get(cell)
                if area:
                    for item in area.buildings:
                        rows[item.id] = SceneBuilding(item.id, item.geometry, item.tags, None, None)
            parent = ray.target.tags.get("view:parent", ray.target.id)
            if parent != ray.target.id:
                rows.pop(parent, None)
            samples = await asyncio.to_thread(scene_samples, ray, tuple(rows.values()))
            heights = await asyncio.to_thread(self._terrain.sample_points, samples.points)
            base = base_elevation(
                heights, tuple(k for k in samples.points if k.startswith("observer-ground:"))
            )
            target_base = base_elevation(
                heights, tuple(k for k in samples.points if k.startswith("target-ground:"))
            )
            if ray.target.tags.get("water") == "sea":
                target_base = ElevationRange(-0.5, 0.5)
            elif (
                ray.target.tags.get("natural") in {"peak", "volcano", "hill"}
                and "target" in heights
            ):
                target_base = ElevationRange(heights["target"] - 2, heights["target"] + 2)
            if base is None or target_base is None:
                reasons[ray.hotel_id] = (
                    "Не получены высоты рельефа у отеля или ориентира: линию обзора рассчитать невозможно."
                )
                continue
            target = ElevationRange(
                target_base.minimum_m + ray.target_height.minimum_m,
                target_base.maximum_m + ray.target_height.maximum_m
                if target_base.maximum_m is not None and ray.target_height.maximum_m is not None
                else None,
            )
            loaded = [area for cell in cell_sets[ray.id] if (area := areas.get(cell)) is not None]
            complete = (
                not buildings.truncated
                and len(loaded) == len(cell_sets[ray.id])
                and all(area.complete for area in loaded)
            )
            missing = [] if complete else ["неполное покрытие контуров зданий вдоль линии"]
            obstructions = obstacles(samples, heights)
            if any(
                item.elevation is None or item.elevation.maximum_m is None for item in obstructions
            ):
                missing.append("высоты части препятствий или участки рельефа")
            if ray.dimensions.levels is None:
                missing.append("этажность отеля; рассчитано условное окно первого этажа")
            for level in ray.floors:
                step_low, step_high = 2.7, 4.5
                if (
                    ray.dimensions.height
                    and ray.dimensions.levels
                    and ray.dimensions.height.maximum_m
                ):
                    step_low = max(2, (ray.dimensions.height.minimum_m - 3) / ray.dimensions.levels)
                    step_high = ray.dimensions.height.maximum_m / ray.dimensions.levels
                observer = ElevationRange(
                    base.minimum_m + (level - 1) * step_low + 1.2,
                    base.maximum_m + (level - 1) * step_high + 1.8
                    if base.maximum_m is not None
                    else None,
                )
                result = sightline(
                    samples.distance_m, observer, target, obstructions, complete_coverage=complete
                )
                sources = tuple(
                    dict.fromkeys(
                        [
                            ray.target.source_url,
                            "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
                            *(area.source_url for area in loaded),
                        ]
                    )
                )
                report = WindowReport(
                    ray,
                    result,
                    level,
                    observer,
                    target,
                    samples.distance_m,
                    obstructions,
                    sources,
                    tuple(missing),
                )
                old = reports.get(ray.hotel_id)
                rank = {"visible": 2, "unknown": 1, "blocked": 0}
                if old is None or (rank[result.status], -level) > (
                    rank[old.result.status],
                    -old.floor,
                ):
                    reports[ray.hotel_id] = report
                if result.status == "visible":
                    break
        facts: list[SearchFactRecord] = []
        features: list[GeoFeatureRecord] = []
        for hotel in prepared.hotels:
            fact, geometry = window_evidence(
                hotel.id,
                prepared.request,
                now,
                reports.get(hotel.id),
                reasons.get(hotel.id),
                hotel.id in prepared.rejected,
                hotel.id not in prepared.unchecked,
            )
            facts.append(fact)
            features.extend(geometry)
        return WindowEvidence(tuple(facts), tuple(features))
