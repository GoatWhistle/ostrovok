from dataclasses import dataclass, field
from datetime import date, datetime
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


@dataclass(frozen=True, slots=True, kw_only=True)
class RegionRecord:
    id: str
    name: str
    bbox: tuple[float, float, float, float]
    hotels_count: int
    data_as_of: date


@dataclass(frozen=True, slots=True, kw_only=True)
class NamedPlaceRecord:
    id: str
    name: str
    location: tuple[float, float]


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchHotelRecord:
    id: str
    region_id: str
    name: str
    location: tuple[float, float]
    stars: int | None
    building_id: str | None
    height_m: float | None
    levels: int | None
    footprint: Geometry | None
    address: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierContentRecord:
    hotel_id: str
    supplier: str
    facilities_ru: tuple[str, ...]
    facilities_en: tuple[str, ...]
    updated_at: datetime


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchFactRecord:
    hotel_id: str
    id: str
    characteristic_key: str
    value: Any
    unit: str | None
    qualifiers: dict[str, Any]
    source_type: str
    source_id: str | None
    method: str
    confidence: float
    computed_at: datetime
    valid_until: datetime | None
    status: str
    geo_refs: tuple[str, ...]
    explanation: str
    facade_azimuth: float | None


@dataclass(frozen=True, slots=True, kw_only=True)
class GeoFeatureRecord:
    id: str
    kind: str
    characteristic_key: str
    geometry: Geometry
    name: str | None
    label: str | None
    osm_ref: str | None
    style_hint: str | None
    properties: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True, slots=True, kw_only=True)
class FacadeRecord:
    id: str
    azimuth_deg: float
    label: str
    geometry: Geometry


@dataclass(frozen=True, slots=True, kw_only=True)
class BuildingRecord:
    id: str
    geometry: Geometry
    height_m: float | None
    levels: int | None
    height_estimated: bool = False
