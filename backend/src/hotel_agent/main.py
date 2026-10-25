import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from hotel_agent.adapters.geo.country_scope import CountryBoundary
from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.terrain_measurements import TerrainMeasurements
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.weather.open_meteo import OpenMeteoWeather
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.get_geo_features import GetGeoFeatures
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
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
from hotel_agent.interfaces.http.search_schemas import search_schema
from hotel_agent.settings import Settings, load_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or load_settings(os.environ)
    logger = StdlibLogger("hotel_agent", info=True)
    providers = build_providers(config, logger)
    terrain_tiles = CountryTerrainTiles(config.seed_dir / "sochi" / "dem.tif")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.providers = providers
        try:
            yield
        finally:
            terrain_tiles.close()
            await providers.aclose()

    app = FastAPI(title="Hotel Agent API", version="0.1.0", lifespan=lifespan)
    ErrorHandlers(logger).register(app)
    search_hotels = SearchHotels(
        providers.llm,
        providers.uow,
        providers.clock,
        providers.place_lookup,
        DataExplorer(
            providers.llm,
            providers.uow,
            TerrainMeasurements(terrain_tiles),
            providers.clock,
            logger,
            CountryBoundary(config.seed_dir / "russia-boundary.geojson"),
        ),
    )
    app.include_router(
        api_router_v1(
            llm_provider=providers.llm.provider,
            list_characteristics=ListCharacteristics(providers.registry),
            list_regions=ListRegions(providers.uow),
            search_hotels=search_hotels,
            chat_service=Chat(
                providers.llm,
                providers.uow,
                search_hotels,
                lambda outcome: search_schema(outcome, providers.registry, 0).model_dump(
                    mode="json"
                ),
            ),
            registry=providers.registry,
            get_geo_features=GetGeoFeatures(providers.uow),
            get_hotel_card=GetHotelCard(providers.uow),
            get_hotel_offers=GetHotelOffers(providers.uow, providers.hotel_offers, providers.clock),
            get_hotel_scene=GetHotelScene(providers.uow),
            get_map_tile=GetMapTile(providers.uow),
            get_terrain_tile=GetTerrainTile(terrain_tiles),
            get_weather=GetWeather(OpenMeteoWeather()),
        )
    )
    return app
