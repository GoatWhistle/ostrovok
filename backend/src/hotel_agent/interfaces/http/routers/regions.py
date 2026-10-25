from fastapi import APIRouter

from hotel_agent.application.use_cases.list_regions import ListRegions
from hotel_agent.interfaces.http.schemas import RegionListResponse, region_schema


def build_router(list_regions: ListRegions) -> APIRouter:
    router = APIRouter(tags=["meta"])

    @router.get("/regions", response_model=RegionListResponse)
    async def regions() -> RegionListResponse:
        items = [region_schema(item) for item in await list_regions()]
        return RegionListResponse(items=items)

    return router
