from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any

from pyproj import Geod

from hotel_agent.application.dto import GeoFeatureRecord, SearchFactRecord
from hotel_agent.application.ports.window_views import WindowRay
from hotel_agent.application.spatial_matching import spatial_key
from hotel_agent.domain.query import SpatialRequest
from hotel_agent.domain.visibility import ElevationRange, RayObstacle, SightlineResult


@dataclass(frozen=True, slots=True)
class WindowReport:
    ray: WindowRay
    result: SightlineResult
    floor: int
    observer: ElevationRange
    target: ElevationRange
    distance_m: float
    obstacles: tuple[RayObstacle, ...]
    sources: tuple[str, ...]
    missing: tuple[str, ...]


def window_evidence(
    hotel_id: str,
    request: SpatialRequest,
    now: datetime,
    report: WindowReport | None,
    reason: str | None,
    rejected: bool = False,
    evaluated: bool = True,
) -> tuple[SearchFactRecord, tuple[GeoFeatureRecord, ...]]:
    key = spatial_key(request)
    identity = f"{hotel_id}_{key.removeprefix('spatial:')}"
    refs: list[str] = []
    features = []
    visibility: dict[str, Any] = {
        "status": "blocked" if rejected else "unknown",
        "reason": reason,
        "bookable_room_confirmed": False,
        "calculation_attempted": evaluated,
    }
    explanation = reason or "Недостаточно данных для проверки вида из окна."
    value = False if rejected else None
    azimuth = None
    if report is not None:
        ray, result = report.ray, report.result
        azimuth = ray.observer.azimuth_deg
        condition_status = (
            "unknown"
            if request.target_part == "whole" and result.status == "visible"
            else result.status
        )
        value = (
            True
            if condition_status == "visible"
            else False
            if condition_status == "blocked"
            else None
        )
        name = ray.target.tags.get("name", request.target or "Море")
        visibility.update(
            {
                "status": condition_status,
                "sampled_line_status": result.status,
                "target_id": ray.target.tags.get("view:parent", ray.target.id),
                "target_part_id": ray.target.id,
                "requested_target_scope": request.target_part,
                "entire_target_verified": False,
                "target_tags": {
                    key.removeprefix("view:parent:"): value
                    for key, value in ray.target.tags.items()
                    if key.startswith("view:parent:")
                }
                or {
                    key: value
                    for key, value in ray.target.tags.items()
                    if not key.startswith("view:")
                },
                "target_part_tags": {
                    key: value
                    for key, value in ray.target.tags.items()
                    if not key.startswith("view:")
                },
                "target_name": name,
                "target_location": list(ray.target_location),
                "observer_location": list(ray.observer.location),
                "observer_elevation_m": asdict(report.observer),
                "target_elevation_m": asdict(report.target),
                "floor": report.floor,
                "facade_azimuth_deg": azimuth,
                "distance_m": round(report.distance_m, 1),
                "minimum_clearance_m": result.minimum_clearance_m,
                "required_observer_elevation_m": result.required_observer_elevation_m,
                "complete_coverage": result.complete_coverage,
                "unknown_obstacles": result.unknown_obstacles,
                "blockers": [asdict(blocker) for blocker in result.blockers[:12]],
                "missing": list(report.missing),
                "sources": list(report.sources),
                "building_height_source": ray.dimensions.height_source,
                "profile": [asdict(obstacle) for obstacle in report.obstacles],
                "curvature_coefficient": 6 / 7,
                "terrain_step_m": 25,
                "horizontal_field_of_view_deg": 120,
            }
        )
        text = {
            "visible": "Линия обзора свободна в расчётной модели",
            "blocked": "Линия обзора перекрыта",
            "unknown": "Свободный обзор подтвердить не удалось",
        }[result.status]
        explanation = (
            f"{text}: «{name}», {round(report.distance_m)} м, этаж {report.floor}, "
            f"направление окон {round(azimuth)}°. Проверены рельеф и здания на всём пути. "
        )
        if result.blockers:
            confirmed = next((b for b in result.blockers if b.confirmed), result.blockers[0])
            kind = "здание" if confirmed.kind == "building" else "рельеф"
            obstacle_label = "Препятствие" if confirmed.confirmed else "Возможное препятствие"
            explanation += f"{obstacle_label}: {kind}, {round(confirmed.distance_m)} м от окна. "
        if report.missing:
            explanation += "Не хватает данных: " + "; ".join(report.missing) + ". "
        if request.target_part == "whole":
            explanation += (
                "Проверена линия к части ориентира; полный обзор всего объекта не подтверждён. "
            )
        explanation += (
            "Это оценка геометрии фасада; наличие номера с такими окнами нужно подтвердить у отеля."
        )
        for suffix, kind, geometry, label, osm_ref, style in (
            (
                "ray",
                "line",
                {
                    "type": "LineString",
                    "coordinates": [list(ray.observer.location), list(ray.target_location)],
                },
                "Линия обзора",
                None,
                "line",
            ),
            (
                "target",
                "poi",
                {"type": "Point", "coordinates": list(ray.target_location)},
                name,
                ray.target.id,
                "points",
            ),
            (
                "observer",
                "poi",
                {"type": "Point", "coordinates": list(ray.observer.location)},
                f"Окно: этаж {report.floor}",
                None,
                "points",
            ),
        ):
            ref = f"g_window_{identity}_{suffix}"
            refs.append(ref)
            features.append(
                GeoFeatureRecord(
                    id=ref,
                    kind=kind,
                    characteristic_key=key,
                    geometry=geometry,
                    name=label,
                    label=label,
                    osm_ref=osm_ref,
                    style_hint=style,
                )
            )
        azimuth_to_target, _, _ = Geod(ellps="WGS84").inv(
            *ray.observer.location, *ray.target_location
        )
        for index, blocker in enumerate(result.blockers[:3]):
            lon, lat, _ = Geod(ellps="WGS84").fwd(
                *ray.observer.location, azimuth_to_target, blocker.distance_m
            )
            ref = f"g_window_{identity}_blocker_{index}"
            refs.append(ref)
            label = ("Здание" if blocker.kind == "building" else "Рельеф") + (
                ": перекрывает вид" if blocker.confirmed else ": возможное препятствие"
            )
            features.append(
                GeoFeatureRecord(
                    id=ref,
                    kind="poi",
                    characteristic_key=key,
                    geometry={"type": "Point", "coordinates": [lon, lat]},
                    name=label,
                    label=label,
                    osm_ref=blocker.id if blocker.kind == "building" else None,
                    style_hint="points",
                )
            )
    record = SearchFactRecord(
        hotel_id=hotel_id,
        id=f"f_window_{identity}",
        characteristic_key=key,
        value=value,
        unit=None,
        qualifiers={
            "source_text": request.source_text,
            "estimated_view": True,
            "visibility": visibility,
        },
        source_type="computed",
        source_id=report.ray.target.source_url if report else None,
        method="window_visibility@1",
        confidence=0.8 if value is not None else 0.3,
        computed_at=now,
        valid_until=now + timedelta(days=7),
        status="active",
        geo_refs=tuple(refs),
        explanation=explanation,
        facade_azimuth=azimuth,
    )
    return record, tuple(features)
