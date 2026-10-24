from fastapi import APIRouter

from hotel_agent.interfaces.http.schemas import HealthResponse


def build_router(llm_provider: str) -> APIRouter:
    router = APIRouter(tags=["meta"])

    @router.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(status="ok", llm_provider=llm_provider)

    return router
