from typing import Literal

from pydantic import BaseModel, Field

from hotel_agent.application.dto import RegionRecord
from hotel_agent.domain.characteristics import (
    BetterDirection,
    Characteristic,
    CompareGroup,
    FieldKind,
    GeoStyle,
    Scope,
    SourceType,
    ValueType,
)


class ErrorResponse(BaseModel):
    code: str
    message: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    llm_provider: str


class DisplaySchema(BaseModel):
    icon: str
    color: str
    geo_style: GeoStyle


class CompareHintSchema(BaseModel):
    group: CompareGroup
    better: BetterDirection | None = None


class AnswerFieldSchema(BaseModel):
    name: str
    kind: FieldKind
    unit: str | None


class CharacteristicSchema(BaseModel):
    key: str
    title: str
    description: str
    value_type: ValueType
    unit: str | None
    scope: Scope
    ttl_days: int
    source_kinds: list[SourceType]
    answer_fields: list[AnswerFieldSchema] = Field(default_factory=list)
    display: DisplaySchema
    compare: CompareHintSchema | None = None


class CharacteristicListResponse(BaseModel):
    items: list[CharacteristicSchema] = Field(default_factory=list)


class CameraSchema(BaseModel):
    center: tuple[float, float]
    zoom: float
    pitch: float
    bearing: float
    focus_facade_id: str | None = None


class RegionSchema(BaseModel):
    id: str
    name: str
    bbox: tuple[float, float, float, float]
    hotels_count: int
    data_as_of: str
    default_camera: CameraSchema


class RegionListResponse(BaseModel):
    items: list[RegionSchema]


def region_schema(region: RegionRecord) -> RegionSchema:
    west, south, east, north = region.bbox
    national = region.id == "russia"
    return RegionSchema(
        id=region.id,
        name=region.name,
        bbox=region.bbox,
        hotels_count=region.hotels_count,
        data_as_of=region.data_as_of.isoformat(),
        default_camera=CameraSchema(
            center=(95, 61) if national else ((west + east) / 2, (south + north) / 2),
            zoom=3 if national else 10,
            pitch=45,
            bearing=0,
        ),
    )


def characteristic_schema(characteristic: Characteristic) -> CharacteristicSchema:
    return CharacteristicSchema(
        key=characteristic.key,
        title=characteristic.title_ru,
        description=characteristic.description,
        value_type=characteristic.value_type,
        unit=characteristic.unit,
        scope=characteristic.scope,
        ttl_days=characteristic.ttl_days,
        source_kinds=list(characteristic.source_kinds),
        answer_fields=[
            AnswerFieldSchema(
                name=field.name,
                kind=field.kind,
                unit=field.units[0] if field.units else None,
            )
            for field in characteristic.fields
        ],
        compare=CompareHintSchema(
            group=characteristic.compare.group, better=characteristic.compare.better
        )
        if characteristic.compare
        else None,
        display=DisplaySchema(
            icon=characteristic.display.icon,
            color=characteristic.display.color,
            geo_style=characteristic.display.geo_style,
        ),
    )
