from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from hotel_agent.application.dto import (
    GeoFeatureRecord,
    NamedPlaceRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.ports.view_geometry import PhysicalObject
from hotel_agent.application.ports.view_scenes import PathBuildings, SceneBuilding
from hotel_agent.application.visibility_records import BuildingDimensions, FacadeObserver
from hotel_agent.domain.query import SpatialRequest
from hotel_agent.domain.visibility import ElevationRange


@dataclass(frozen=True, slots=True)
class WindowRay:
    id: str
    hotel_id: str
    observer: FacadeObserver
    dimensions: BuildingDimensions
    target: PhysicalObject
    target_location: tuple[float, float]
    target_height: ElevationRange
    floors: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class PreparedViews:
    request: SpatialRequest
    hotels: tuple[SearchHotelRecord, ...]
    rays: tuple[WindowRay, ...]
    reasons: Mapping[str, str]
    rejected: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class WindowEvidence:
    facts: tuple[SearchFactRecord, ...]
    features: tuple[GeoFeatureRecord, ...]


class WindowViewsPort(Protocol):
    async def prepare(
        self,
        hotels: Sequence[SearchHotelRecord],
        request: SpatialRequest,
        targets: Mapping[str, NamedPlaceRecord | tuple[float, float]],
        buildings: Mapping[str, SceneBuilding],
    ) -> PreparedViews: ...

    async def evaluate(
        self, prepared: PreparedViews, buildings: PathBuildings, now: datetime
    ) -> WindowEvidence: ...
