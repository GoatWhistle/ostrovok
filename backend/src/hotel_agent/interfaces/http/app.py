from fastapi import APIRouter

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.get_geo_features import GetGeoFeatures
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.get_hotel_scene import GetHotelScene
from hotel_agent.application.use_cases.get_map_tile import GetMapTile
from hotel_agent.application.use_cases.get_terrain_tile import GetTerrainTile
from hotel_agent.application.use_cases.get_weather import GetWeather
from hotel_agent.application.use_cases.list_characteristics import ListCharacteristics
from hotel_agent.application.use_cases.list_regions import ListRegions
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.interfaces.http.routers import (
    chat,
    geo,
    health,
    hotels,
    map_tiles,
    meta,
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
    get_hotel_scene: GetHotelScene,
    get_map_tile: GetMapTile,
    get_terrain_tile: GetTerrainTile,
    get_weather: GetWeather,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    router.include_router(health.build_router(llm_provider))
    router.include_router(meta.build_router(list_characteristics))
    router.include_router(regions.build_router(list_regions))
    router.include_router(search.build_router(search_hotels, registry))
    router.include_router(chat.build_router(chat_service, registry))
    router.include_router(geo.build_router(get_geo_features))
    router.include_router(hotels.build_router(get_hotel_card, get_hotel_scene))
    router.include_router(map_tiles.build_router(get_map_tile))
    router.include_router(terrain.build_router(get_terrain_tile))
    router.include_router(weather.build_router(get_weather))
    return router
