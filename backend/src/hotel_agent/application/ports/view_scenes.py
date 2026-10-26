from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class SceneBuilding:
    id: str
    geometry: dict[str, Any]
    tags: dict[str, str]
    height_m: float | None
    levels: int | None


@dataclass(frozen=True, slots=True)
class PathBuildings:
    buildings: Mapping[str, tuple[SceneBuilding, ...]]
    truncated: bool
    coverage_sources: Mapping[str, str] = field(default_factory=dict)


class ViewSceneRepository(Protocol):
    async def hotel_buildings(self, hotel_ids: Sequence[str]) -> Mapping[str, SceneBuilding]: ...

    async def path_buildings(
        self, paths: Mapping[str, tuple[tuple[float, float], ...]]
    ) -> PathBuildings: ...
