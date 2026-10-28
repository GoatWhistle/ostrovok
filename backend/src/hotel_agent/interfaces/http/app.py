from fastapi import APIRouter

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.answer_questions import AnswerHotelierQuestions
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.compare_hotels import CompareHotels
from hotel_agent.application.use_cases.get_fact import GetFact
from hotel_agent.application.use_cases.get_geo_features import GetGeoFeatures
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.get_hotel_details import GetHotelDetails
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.application.use_cases.get_hotel_scene import GetHotelScene
from hotel_agent.application.use_cases.get_map_catalog import GetMapCatalog
from hotel_agent.application.use_cases.get_map_scene import GetMapScene
from hotel_agent.application.use_cases.get_map_style import GetMapStyle
from hotel_agent.application.use_cases.get_map_tile import GetMapTile
from hotel_agent.application.use_cases.get_place import GetPlace
from hotel_agent.application.use_cases.get_terrain_tile import GetTerrainTile
from hotel_agent.application.use_cases.get_weather import GetWeather
from hotel_agent.application.use_cases.hotelier_cabinet import GetHotelierCabinet
from hotel_agent.application.use_cases.hotelier_notifications import (
    ListHotelierNotifications,
    MarkNotificationsRead,
)
from hotel_agent.application.use_cases.hotelier_questions import (
    ChangeQuestionStatus,
    ListHotelierQuestions,
)
from hotel_agent.application.use_cases.list_characteristics import ListCharacteristics
from hotel_agent.application.use_cases.list_regions import ListRegions
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.interfaces.http.routers import (
    chat,
    compare,
    geo,
    health,
    hotelier,
    hotels,
    map_catalog,
    map_scene,
    map_style,
    map_tiles,
    meta,
    places,
    regions,
    search,
    terrain,
    weather,
)


def api_router_v1(
    *,
    llm_provider: str,
    list_characteristics: ListCharacteristics,
    list_regions: ListRegions,
    search_hotels: SearchHotels,
    chat_service: Chat,
    registry: CharacteristicRegistryPort,
    get_geo_features: GetGeoFeatures,
    get_hotel_card: GetHotelCard,
    get_place: GetPlace,
    compare_hotels: CompareHotels,
    get_hotel_offers: GetHotelOffers,
    get_hotel_details: GetHotelDetails,
    get_hotel_scene: GetHotelScene,
    get_map_tile: GetMapTile,
    get_map_catalog: GetMapCatalog,
    get_terrain_tile: GetTerrainTile,
    get_weather: GetWeather,
    get_fact: GetFact,
    list_hotelier_questions: ListHotelierQuestions,
    answer_hotelier_question: AnswerHotelierQuestion,
    change_question_status: ChangeQuestionStatus,
    change_facts: ChangeFacts,
    hotelier_cabinet: GetHotelierCabinet,
    list_hotelier_notifications: ListHotelierNotifications,
    read_hotelier_notifications: MarkNotificationsRead,
    answer_hotelier_questions: AnswerHotelierQuestions,
    get_map_style: GetMapStyle,
    get_map_scene: GetMapScene,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    router.include_router(places.build_router(get_place))
    router.include_router(compare.build_router(compare_hotels))
    router.include_router(health.build_router(llm_provider))
    router.include_router(meta.build_router(list_characteristics))
    router.include_router(regions.build_router(list_regions))
    router.include_router(search.build_router(search_hotels, registry))
    router.include_router(chat.build_router(chat_service, registry))
    router.include_router(geo.build_router(get_geo_features))
    router.include_router(
        hotels.build_router(
            get_hotel_card, get_hotel_scene, get_hotel_offers, get_fact, get_hotel_details
        )
    )
    router.include_router(
        hotelier.build_router(
            list_hotelier_questions,
            answer_hotelier_question,
            change_question_status,
            change_facts,
            hotelier_cabinet,
            list_hotelier_notifications,
            read_hotelier_notifications,
            answer_hotelier_questions,
        )
    )
    router.include_router(map_tiles.build_router(get_map_tile))
    router.include_router(map_catalog.build_router(get_map_catalog))
    router.include_router(map_style.build_router(get_map_style))
    router.include_router(map_scene.build_router(get_map_scene))
    router.include_router(terrain.build_router(get_terrain_tile))
    router.include_router(weather.build_router(get_weather))
    return router
