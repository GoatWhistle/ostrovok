from collections.abc import Mapping, Sequence
from typing import Protocol

from hotel_agent.application.dto import Feature, SeedLayers
from hotel_agent.domain.value_objects import BBox


class RegionSourcePort(Protocol):
    @property
    def description(self) -> str: ...

    def read(self, bbox: BBox) -> SeedLayers: ...


class SeedStorePort(Protocol):
    def save_layer(self, name: str, features: Sequence[Feature]) -> int: ...

    def save_meta(self, meta: Mapping[str, object]) -> None: ...


class ElevationSourcePort(Protocol):
    @property
    def description(self) -> str: ...

    def crop(self, bbox: BBox) -> Mapping[str, object]: ...
