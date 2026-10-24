from typing import Literal

from pydantic import BaseModel, Field

from hotel_agent.domain.characteristics import (
    Characteristic,
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


class CharacteristicSchema(BaseModel):
    key: str
    title: str
    description: str
    value_type: ValueType
    unit: str | None
    scope: Scope
    ttl_days: int
    source_kinds: list[SourceType]
    display: DisplaySchema


class CharacteristicListResponse(BaseModel):
    items: list[CharacteristicSchema] = Field(default_factory=list)


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
        display=DisplaySchema(
            icon=characteristic.display.icon,
            color=characteristic.display.color,
            geo_style=characteristic.display.geo_style,
        ),
    )
