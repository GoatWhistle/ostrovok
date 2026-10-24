from dataclasses import dataclass, field
from typing import Any

type Geometry = dict[str, Any]


@dataclass(frozen=True, slots=True, kw_only=True)
class Feature:
    id: str
    geometry: Geometry
    properties: dict[str, str]


@dataclass(slots=True)
class SeedLayers:
    hotels: list[Feature] = field(default_factory=list)
    buildings: list[Feature] = field(default_factory=list)
    pois: list[Feature] = field(default_factory=list)
    coastline: list[Feature] = field(default_factory=list)
    beaches: list[Feature] = field(default_factory=list)
    noise_sources: list[Feature] = field(default_factory=list)
    walk: list[Feature] = field(default_factory=list)

    def names(self) -> tuple[str, ...]:
        return tuple(self.__slots__)

    def counts(self) -> dict[str, int]:
        return {name: len(getattr(self, name)) for name in self.__slots__}
