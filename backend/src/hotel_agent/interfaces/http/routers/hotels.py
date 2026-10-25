from datetime import date

from fastapi import APIRouter, Query

from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.application.use_cases.get_hotel_scene import GetHotelScene
from hotel_agent.domain.errors import FactNotFound
from hotel_agent.interfaces.http.hotel_schemas import (
    FactDetailSchema,
    HotelCardSchema,
    HotelOffersSchema,
    HotelSceneSchema,
    fact_schema,
    hotel_card_schema,
    hotel_offers_schema,
    hotel_scene_schema,
)


def build_router(
    get_card: GetHotelCard, get_scene: GetHotelScene, get_offers: GetHotelOffers
) -> APIRouter:
    router = APIRouter(tags=["hotels"])

    @router.get("/hotels/{hotel_id}", response_model=HotelCardSchema)
    async def card(hotel_id: str) -> HotelCardSchema:
        return hotel_card_schema(await get_card(hotel_id))

    @router.get("/hotels/{hotel_id}/offers", response_model=HotelOffersSchema)
    async def offers(
        hotel_id: str,
        check_in: date,
        check_out: date,
        adults: int = Query(default=2, ge=1, le=10),
        residency: str = Query(default="ru", pattern="^[a-z]{2}$"),
    ) -> HotelOffersSchema:
        return hotel_offers_schema(
            await get_offers(hotel_id, check_in, check_out, adults, residency)
        )

    @router.get("/hotels/{hotel_id}/scene", response_model=HotelSceneSchema)
    async def scene(
        hotel_id: str, context_radius_m: float = Query(default=250, ge=0, le=500)
    ) -> HotelSceneSchema:
        return hotel_scene_schema(await get_scene(hotel_id, context_radius_m))

    @router.get("/hotels/{hotel_id}/facts/{fact_id}", response_model=FactDetailSchema)
    async def fact(hotel_id: str, fact_id: str) -> FactDetailSchema:
        card = await get_card(hotel_id)
        found = next((item for item in card.facts if str(item.id) == fact_id), None)
        if found is None:
            raise FactNotFound()
        return FactDetailSchema.model_validate(fact_schema(found).model_dump())

    return router
