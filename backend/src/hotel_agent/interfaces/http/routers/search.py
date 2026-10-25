from time import perf_counter

from fastapi import APIRouter

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.interfaces.http.search_schemas import (
    SearchRequestSchema,
    SearchResponseSchema,
    search_schema,
)


def build_router(search_hotels: SearchHotels, registry: CharacteristicRegistryPort) -> APIRouter:
    router = APIRouter(tags=["search"])

    @router.post("/search", response_model=SearchResponseSchema, response_model_exclude_none=True)
    async def search(request: SearchRequestSchema) -> SearchResponseSchema:
        started = perf_counter()
        outcome = await search_hotels(
            request.query,
            request.region_id or "russia",
            request.bbox,
            request.limit,
        )
        return search_schema(outcome, registry, round((perf_counter() - started) * 1000))

    return router
