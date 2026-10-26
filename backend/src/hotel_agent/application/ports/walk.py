from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class WalkPath:
    hotel_id: str
    minutes: float
    meters: float
    elevation_delta_m: float
    geometry: dict[str, object]


class WalkSourcePort(Protocol):
    def calculate(self, directory: Path) -> Sequence[WalkPath]: ...


class WalkStorePort(Protocol):
    async def save(self, region: str, paths: Sequence[WalkPath]) -> int: ...


@dataclass(frozen=True, slots=True, kw_only=True)
class PlaceWalk:
    hotel_id: str
    place_id: str
    meters: float
    minutes: float | None
    mode: Literal["graph", "straight"]
    geometry: dict[str, object]


class WalkRouterPort(Protocol):
    async def routes(
        self, origin: str, targets: Sequence[str], max_m: float
    ) -> Sequence[PlaceWalk]: ...
