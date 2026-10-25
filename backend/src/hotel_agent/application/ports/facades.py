from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class BuildingFootprint:
    hotel_id: str
    building_id: str
    geometry: dict[str, object]


@dataclass(frozen=True, slots=True, kw_only=True)
class FacadeSegment:
    id: str
    hotel_id: str
    building_id: str
    azimuth_deg: float
    label: str
    geometry: dict[str, object]


class FacadeExtractorPort(Protocol):
    def extract(self, footprint: BuildingFootprint) -> Sequence[FacadeSegment]: ...


class FacadeStorePort(Protocol):
    async def footprints(self, region: str) -> Sequence[BuildingFootprint]: ...

    async def save(self, region: str, facades: Sequence[FacadeSegment]) -> int: ...

    async def compute_noise(self, region: str) -> int: ...
