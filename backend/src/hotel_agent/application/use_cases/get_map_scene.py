import math
from dataclasses import dataclass

from hotel_agent.application.ports.map_scene import SceneBuildingRecord
from hotel_agent.application.ports.map_style import MapStylePort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import InvalidQuery, MapVersionChanged, RegionNotFound

MAX_BUILDINGS = 800
MAX_VERTICES = 100_000
MAX_BUILDING_POINTS = 5_000
MAX_AREA_KM2 = 4.0
MIN_ZOOM, MAX_ZOOM = 16, 19
LEVEL_HEIGHT_M = 3.2
ESTIMATED_HEIGHT_M = 6.4
EARTH_RADIUS_KM = 6371.0088


@dataclass(frozen=True, slots=True, kw_only=True)
class SceneBuilding:
    record: SceneBuildingRecord
    render_height_m: float
    height_estimated: bool


@dataclass(frozen=True, slots=True, kw_only=True)
class MapScene:
    region_id: str
    version: str | None
    bbox: tuple[float, float, float, float]
    buildings: tuple[SceneBuilding, ...]
    truncated: bool
    eligible_count: int


def area_km2(bbox: tuple[float, float, float, float]) -> float:
    west, south, east, north = bbox
    height = math.radians(north - south) * EARTH_RADIUS_KM
    width = (
        math.radians(east - west) * EARTH_RADIUS_KM * math.cos(math.radians((north + south) / 2))
    )
    return width * height


def parse_bbox(raw: str) -> tuple[float, float, float, float]:
    try:
        values = tuple(float(part) for part in raw.split(","))
    except ValueError:
        raise InvalidQuery("bbox must contain four numbers") from None
    if len(values) != 4 or not all(math.isfinite(value) for value in values):
        raise InvalidQuery("bbox must contain four numbers")
    west, south, east, north = values
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise InvalidQuery("bbox must read west,south,east,north in WGS84")
    return west, south, east, north


def render_height(record: SceneBuildingRecord) -> tuple[float, bool]:
    if record.height_m is not None and record.height_m > 0:
        return record.height_m, False
    if record.levels is not None and record.levels > 0:
        return record.levels * LEVEL_HEIGHT_M, True
    return ESTIMATED_HEIGHT_M, True


class GetMapScene:
    def __init__(self, uow: UnitOfWorkFactory, files: MapStylePort) -> None:
        self._uow, self._files = uow, files

    async def __call__(
        self, region_id: str, raw_bbox: str, zoom: float, version: str | None
    ) -> MapScene:
        bbox = parse_bbox(raw_bbox)
        if not MIN_ZOOM <= zoom <= MAX_ZOOM:
            raise InvalidQuery("zoom must be between 16 and 19")
        if area_km2(bbox) > MAX_AREA_KM2:
            raise InvalidQuery("bbox must cover at most 4 km²")
        async with self._uow() as uow:
            regions = {item.id: item for item in await uow.regions.list_loaded()}
            if region_id not in regions:
                raise RegionNotFound()
            current = self._files.region(region_id).tiles_version
            if version is not None and version != current:
                raise MapVersionChanged()
            found = await uow.map_scene.candidates(region_id, bbox, MAX_BUILDINGS * 2)
        selected: list[SceneBuilding] = []
        vertices = 0
        skipped = 0
        for record in found.buildings:
            if record.points > MAX_BUILDING_POINTS:
                skipped += 1
                continue
            if len(selected) == MAX_BUILDINGS or vertices + record.points > MAX_VERTICES:
                break
            height, estimated = render_height(record)
            selected.append(
                SceneBuilding(record=record, render_height_m=height, height_estimated=estimated)
            )
            vertices += record.points
        return MapScene(
            region_id=region_id,
            version=current,
            bbox=bbox,
            buildings=tuple(selected),
            truncated=len(selected) + skipped < found.eligible,
            eligible_count=found.eligible,
        )
