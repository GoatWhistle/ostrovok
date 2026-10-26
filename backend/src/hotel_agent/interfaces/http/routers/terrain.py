import asyncio

from fastapi import APIRouter, HTTPException, Response

from hotel_agent.application.use_cases.get_terrain_tile import GetTerrainTile


def build_router(get_terrain_tile: GetTerrainTile) -> APIRouter:
    router = APIRouter(tags=["map"])

    @router.get("/map/terrain/{z}/{x}/{y}.png", response_class=Response)
    async def tile(z: int, x: int, y: int) -> Response:
        if z < 0 or z > 14 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
            raise HTTPException(status_code=404, detail="Terrain tile not found")
        data = await asyncio.to_thread(get_terrain_tile, z, x, y)
        return Response(
            content=data, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"}
        )

    @router.get("/map/relief/{z}/{x}/{y}.png", response_class=Response)
    async def relief(z: int, x: int, y: int) -> Response:
        if z < 0 or z > 14 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
            raise HTTPException(status_code=404, detail="Relief tile not found")
        data = await asyncio.to_thread(get_terrain_tile.relief, z, x, y)
        return Response(
            content=data, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"}
        )

    return router
