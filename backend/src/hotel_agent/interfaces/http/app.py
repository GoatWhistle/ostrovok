from fastapi import APIRouter

from hotel_agent.application.use_cases.list_characteristics import ListCharacteristics
from hotel_agent.interfaces.http.routers import health, meta


def api_router_v1(*, llm_provider: str, list_characteristics: ListCharacteristics) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    router.include_router(health.build_router(llm_provider))
    router.include_router(meta.build_router(list_characteristics))
    return router
