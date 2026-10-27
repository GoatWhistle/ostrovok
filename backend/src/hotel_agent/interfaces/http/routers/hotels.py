from datetime import date

from fastapi import APIRouter, Query

from hotel_agent.application.use_cases.get_fact import GetFact
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.get_hotel_details import GetHotelDetails
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.application.use_cases.get_hotel_scene import GetHotelScene
from hotel_agent.interfaces.http.details_schemas import (
    HotelDetailsSchema,
    hotel_details_schema,
)
from hotel_agent.interfaces.http.hotel_schemas import (
    FactDetailSchema,
    HotelCardSchema,
    HotelSceneSchema,
    hotel_card_schema,
    hotel_scene_schema,
)
from hotel_agent.interfaces.http.hotelier_schemas import fact_detail_schema
from hotel_agent.interfaces.http.offer_schemas import HotelOffersSchema, hotel_offers_schema


def build_router(
    get_card: GetHotelCard,
    get_scene: GetHotelScene,
    get_offers: GetHotelOffers,
    get_fact: GetFact,
    get_details: GetHotelDetails,
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

    @router.get("/hotels/{hotel_id}/details", response_model=HotelDetailsSchema)
    async def details(hotel_id: str) -> HotelDetailsSchema:
        return hotel_details_schema(await get_details(hotel_id))

    @router.get("/hotels/{hotel_id}/scene", response_model=HotelSceneSchema)
    async def scene(
        hotel_id: str, context_radius_m: float = Query(default=250, ge=0, le=500)
    ) -> HotelSceneSchema:
        return hotel_scene_schema(await get_scene(hotel_id, context_radius_m))

    @router.get("/hotels/{hotel_id}/facts/{fact_id}", response_model=FactDetailSchema)
    async def fact(hotel_id: str, fact_id: str) -> FactDetailSchema:
        return fact_detail_schema(await get_fact(hotel_id, fact_id))

    return router
