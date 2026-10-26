from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class SceneBuildingRecord:
    id: str
    hotel_id: str | None
    building_class: str
    class_source: str
    height_m: float | None
    levels: int | None
    height_source: str
    min_height_m: float
    geometry: dict[str, Any]
    points: int


@dataclass(frozen=True, slots=True, kw_only=True)
class SceneCandidates:
    eligible: int
    buildings: tuple[SceneBuildingRecord, ...]


class MapSceneRepository(Protocol):
    async def candidates(
        self,
        region: str,
        bbox: tuple[float, float, float, float],
        limit: int,
    ) -> SceneCandidates: ...
