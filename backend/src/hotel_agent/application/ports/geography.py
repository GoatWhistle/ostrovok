from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, Self

from hotel_agent.application.dto import SeedLayers
from hotel_agent.application.ports.view_geometry import PhysicalArea

type GeographicBounds = tuple[float, float, float, float]


@dataclass(frozen=True, slots=True)
class GeographySnapshot:
    bbox: GeographicBounds
    layers: SeedLayers
    source_url: str
    fetched_at: datetime
    complete: bool


class GeographySourcePort(Protocol):
    async def fetch(self, bbox: GeographicBounds) -> GeographySnapshot | None: ...


class GeographyRepository(Protocol):
    async def cached(self, bbox: GeographicBounds, now: datetime) -> PhysicalArea | None: ...

    async def save(self, snapshot: GeographySnapshot, region: str) -> None: ...


class GeographyUnitOfWork(Protocol):
    geography: GeographyRepository

    async def __aenter__(self) -> Self: ...
    async def __aexit__(self, *exc: object) -> None: ...
    async def commit(self) -> None: ...


class GeographyContextPort(Protocol):
    async def area(self, bbox: GeographicBounds, region: str = "russia") -> PhysicalArea | None: ...
