from fastapi import APIRouter

from hotel_agent.application.use_cases.get_place import GetPlace
from hotel_agent.interfaces.http.place_schemas import PlaceCardSchema, place_schema


def build_router(get_place: GetPlace) -> APIRouter:
    router = APIRouter(tags=["geo"])

    @router.get("/places/{place_id}", response_model=PlaceCardSchema)
    async def place(place_id: str, from_hotel: str | None = None) -> PlaceCardSchema:
        return place_schema(await get_place(place_id, from_hotel))

    return router
