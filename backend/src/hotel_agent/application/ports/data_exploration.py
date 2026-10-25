from collections.abc import Mapping, Sequence
from typing import Any, Protocol


class DataRepository(Protocol):
    async def records(self, dataset: str, hotel_ids: Sequence[str]) -> Sequence[dict[str, Any]]: ...


class TerrainMeasurementPort(Protocol):
    async def measure(
        self, locations: Mapping[str, tuple[float, float]], radius_m: float
    ) -> Mapping[str, Mapping[str, float]]: ...


class GeographicScopePort(Protocol):
    def contains(self, location: tuple[float, float]) -> bool: ...
