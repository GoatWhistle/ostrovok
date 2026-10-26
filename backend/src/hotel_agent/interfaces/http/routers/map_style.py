from fastapi import APIRouter, Query
from pydantic import BaseModel

from hotel_agent.application.use_cases.get_map_style import GetMapStyle, MapStyle

API_PREFIX = "/api/v1"


class MapAssetsSchema(BaseModel):
    basemap_url: str
    glyphs_url: str
    sprite_url: str
    vector_tiles_url: str
    terrain_tiles_url: str | None
    min_zoom: int
    max_zoom: int


class MapCapabilitiesSchema(BaseModel):
    terrain: bool
    render_scene: bool


class MapStyleSchema(BaseModel):
    region_id: str
    available: bool
    reason: str | None
    bbox: tuple[float, float, float, float]
    version: str | None
    catalog_version: str
    tiles_version: str | None
    assets: MapAssetsSchema | None
    capabilities: MapCapabilitiesSchema


def map_style_schema(style: MapStyle) -> MapStyleSchema:
    basemap = style.basemap
    root = f"/maps/{style.region_id}"
    assets = (
        MapAssetsSchema(
            basemap_url=f"{root}/{basemap.archive}",
            glyphs_url=f"{root}/{basemap.glyphs}",
            sprite_url=f"{root}/{basemap.sprite}",
            vector_tiles_url=f"{API_PREFIX}/map/tiles/{{z}}/{{x}}/{{y}}.pbf",
            terrain_tiles_url=f"{API_PREFIX}/map/terrain/{{z}}/{{x}}/{{y}}.png"
            if style.terrain
            else None,
            min_zoom=basemap.min_zoom,
            max_zoom=basemap.max_zoom,
        )
        if basemap
        else None
    )
    return MapStyleSchema(
        region_id=style.region_id,
        available=basemap is not None,
        reason=None if basemap else "basemap_missing",
        bbox=style.bbox,
        version=basemap.version if basemap else None,
        catalog_version=style.catalog_version,
        tiles_version=style.tiles_version,
        assets=assets,
        capabilities=MapCapabilitiesSchema(terrain=style.terrain, render_scene=False),
    )


def build_router(get_style: GetMapStyle) -> APIRouter:
    router = APIRouter(tags=["map"])

    @router.get("/map/style", response_model=MapStyleSchema)
    async def style(
        region_id: str = Query(min_length=1, max_length=64, pattern="^[a-z0-9_-]+$"),
    ) -> MapStyleSchema:
        return map_style_schema(await get_style(region_id))

    return router
