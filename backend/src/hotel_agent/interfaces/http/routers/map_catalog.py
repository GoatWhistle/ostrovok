from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from hotel_agent.application.map_catalog import CATALOG_VERSION
from hotel_agent.application.use_cases.get_map_catalog import GetMapCatalog


class TagRuleSchema(BaseModel):
    tag: str
    values: list[str]


class MapClassSchema(BaseModel):
    key: str
    layer: Literal["ground", "volume", "prop", "poi"]
    match: list[TagRuleSchema]
    priority: int
    min_zoom: int = Field(ge=0, le=22)
    style: dict[str, str]
    props: dict[str, str | float] | None


class MapCatalogSchema(BaseModel):
    version: str = CATALOG_VERSION
    classes: list[MapClassSchema]


def build_router(get_catalog: GetMapCatalog) -> APIRouter:
    router = APIRouter()

    @router.get("/map/catalog", response_model=MapCatalogSchema)
    def catalog() -> MapCatalogSchema:
        return MapCatalogSchema(
            classes=[MapClassSchema.model_validate(asdict(item)) for item in get_catalog()]
        )

    return router
