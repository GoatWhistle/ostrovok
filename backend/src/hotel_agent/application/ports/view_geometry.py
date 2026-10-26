from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class PhysicalObject:
    id: str
    tags: dict[str, str]
    geometry: dict[str, Any]
    source_url: str


@dataclass(frozen=True, slots=True)
class PhysicalArea:
    bbox: tuple[float, float, float, float]
    buildings: tuple[PhysicalObject, ...]
    complete: bool
    source_url: str


class ViewGeometryPort(Protocol):
    async def object(self, identifier: str) -> PhysicalObject | None: ...

    async def area(self, bbox: tuple[float, float, float, float]) -> PhysicalArea | None: ...
