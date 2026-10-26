from fastapi import APIRouter, HTTPException, Response

from hotel_agent.application.use_cases.get_map_tile import GetMapTile


def build_router(get_map_tile: GetMapTile) -> APIRouter:
    router = APIRouter()

    @router.get("/map/tiles/{z}/{x}/{y}.pbf", response_class=Response)
    async def tile(z: int, x: int, y: int) -> Response:
        if z < 0 or z > 19 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
            raise HTTPException(status_code=404, detail="Tile not found")
        data = await get_map_tile(z, x, y)
        return Response(
            content=data,
            media_type="application/vnd.mapbox-vector-tile",
            headers={"Cache-Control": "public, max-age=86400" if data else "public, max-age=30"},
        )

    return router
