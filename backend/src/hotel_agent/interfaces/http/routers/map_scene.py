from typing import Any, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from hotel_agent.application.use_cases.get_map_scene import GetMapScene, MapScene, SceneBuilding


class RenderBuildingSchema(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: dict[str, Any]
    properties: dict[str, Any]


class MapRenderSceneSchema(BaseModel):
    region_id: str
    version: str | None
    bbox: tuple[float, float, float, float]
    truncated: bool
    eligible_count: int
    features: list[RenderBuildingSchema]


def building_schema(item: SceneBuilding) -> RenderBuildingSchema:
    record = item.record
    return RenderBuildingSchema(
        id=record.id,
        geometry=record.geometry,
        properties={
            "building_id": record.id,
            "hotel_id": record.hotel_id,
            "class": record.building_class,
            "class_source": record.class_source,
            "height_m": record.height_m,
            "levels": record.levels,
            "height_source": record.height_source,
            "render_height_m": round(item.render_height_m, 2),
            "height_estimated": item.height_estimated,
            "min_height_m": record.min_height_m,
            "ground_elevation_m": None,
            "ground_source": None,
        },
    )


def scene_schema(scene: MapScene) -> MapRenderSceneSchema:
    return MapRenderSceneSchema(
        region_id=scene.region_id,
        version=scene.version,
        bbox=scene.bbox,
        truncated=scene.truncated,
        eligible_count=scene.eligible_count,
        features=[building_schema(item) for item in scene.buildings],
    )


def build_router(get_scene: GetMapScene) -> APIRouter:
    router = APIRouter(tags=["map"])

    @router.get("/map/scene", response_model=MapRenderSceneSchema)
    async def scene(
        region_id: str = Query(min_length=1, max_length=64, pattern="^[a-z0-9_-]+$"),
        bbox: str = Query(min_length=7, max_length=120),
        zoom: float = Query(),
        v: str | None = Query(default=None, max_length=120),
    ) -> MapRenderSceneSchema:
        return scene_schema(await get_scene(region_id, bbox, zoom, v))

    return router
