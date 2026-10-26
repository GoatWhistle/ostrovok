from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class BasemapRecord:
    version: str
    archive: str
    glyphs: str
    sprite: str
    min_zoom: int
    max_zoom: int
    bbox: tuple[float, float, float, float]


@dataclass(frozen=True, slots=True, kw_only=True)
class RegionMapRecord:
    basemap: BasemapRecord | None
    tiles_version: str | None
    terrain: bool


class MapStylePort(Protocol):
    def region(self, region_id: str) -> RegionMapRecord: ...
