from fastapi import APIRouter

from hotel_agent.application.use_cases.list_characteristics import ListCharacteristics
from hotel_agent.interfaces.http.schemas import CharacteristicListResponse, characteristic_schema


def build_router(list_characteristics: ListCharacteristics) -> APIRouter:
    router = APIRouter(tags=["meta"])

    @router.get("/characteristics", response_model=CharacteristicListResponse)
    async def characteristics() -> CharacteristicListResponse:
        items = [characteristic_schema(item) for item in list_characteristics()]
        return CharacteristicListResponse(items=items)

    return router
