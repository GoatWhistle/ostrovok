import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from hotel_agent.adapters.geo.terrain_tiles import CopernicusTerrainTiles
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.weather.open_meteo import OpenMeteoWeather
from hotel_agent.application.use_cases.get_geo_features import GetGeoFeatures
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.get_hotel_scene import GetHotelScene
from hotel_agent.application.use_cases.get_map_tile import GetMapTile
from hotel_agent.application.use_cases.get_terrain_tile import GetTerrainTile
from hotel_agent.application.use_cases.get_weather import GetWeather
from hotel_agent.application.use_cases.list_characteristics import ListCharacteristics
from hotel_agent.application.use_cases.list_regions import ListRegions
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.composition import build_providers
from hotel_agent.interfaces.http.app import api_router_v1
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.settings import Settings, load_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or load_settings(os.environ)
    logger = StdlibLogger("hotel_agent")
    providers = build_providers(config, logger)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.providers = providers
        try:
            yield
        finally:
            await providers.aclose()

    app = FastAPI(title="Hotel Agent API", version="0.1.0", lifespan=lifespan)
    ErrorHandlers(logger).register(app)
    app.include_router(
        api_router_v1(
            llm_provider=providers.llm.provider,
            list_characteristics=ListCharacteristics(providers.registry),
            list_regions=ListRegions(providers.uow),
            search_hotels=SearchHotels(providers.llm, providers.uow, providers.clock),
            registry=providers.registry,
            get_geo_features=GetGeoFeatures(providers.uow),
            get_hotel_card=GetHotelCard(providers.uow),
            get_hotel_scene=GetHotelScene(providers.uow),
            get_map_tile=GetMapTile(providers.uow),
            get_terrain_tile=GetTerrainTile(
                CopernicusTerrainTiles(config.seed_dir / "sochi" / "dem.tif")
            ),
            get_weather=GetWeather(OpenMeteoWeather()),
        )
    )
    return app
