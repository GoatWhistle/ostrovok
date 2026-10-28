import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI

from hotel_agent.adapters.external.commons_photos import CommonsPhotos
from hotel_agent.adapters.external.event_sources import PublicEvents
from hotel_agent.adapters.external.gbif import GBIFObservations
from hotel_agent.adapters.external.hotel_web_card import WebHotelCard
from hotel_agent.adapters.external.nuitee_catalog import NuiteeCatalog
from hotel_agent.adapters.external.overpass_geography import OverpassGeography
from hotel_agent.adapters.external.web_research import PublicWebResearch
from hotel_agent.adapters.geo.country_scope import CountryBoundary
from hotel_agent.adapters.geo.country_terrain import CountryTerrainTiles
from hotel_agent.adapters.geo.geographic_objects import GeographicObjects
from hotel_agent.adapters.geo.osm_geometry import OSMViewGeometry
from hotel_agent.adapters.geo.search_areas import SearchAreas
from hotel_agent.adapters.geo.terrain_measurements import TerrainMeasurements
from hotel_agent.adapters.geo.view_assessment import NearbyViewAssessment
from hotel_agent.adapters.geo.window_views import WindowViews
from hotel_agent.adapters.geo.worldcover import WorldCover
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.map_catalog.loader import load_catalog
from hotel_agent.adapters.map_style.manifest_files import ManifestFiles
from hotel_agent.adapters.semantic.embedding_cache import CachedEmbeddings
from hotel_agent.adapters.semantic.index import DocumentIndex
from hotel_agent.adapters.semantic.polza import PolzaEmbeddings
from hotel_agent.adapters.semantic.search import SemanticSearch
from hotel_agent.adapters.weather.met_norway import MetNorwayConditions
from hotel_agent.application import progress
from hotel_agent.application.agent.chat_answer_review import ChatAnswerReview
from hotel_agent.application.agent.explore_data import DataExplorer
from hotel_agent.application.agent.recommendation_review import RecommendationReview
from hotel_agent.application.agent.semantic_review import SemanticReview
from hotel_agent.application.map_catalog import CATALOG_VERSION
from hotel_agent.application.ports.place_research import PlaceResearchPort
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.compare_hotels import CompareHotels
from hotel_agent.application.use_cases.ensure_geography import EnsureGeography
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
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
from hotel_agent.application.use_cases.hotelier_questions import (
    ChangeQuestionStatus,
    ListHotelierQuestions,
)
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
    progress.time_stages(logger)
    providers = build_providers(config, logger)
    terrain_tiles = CountryTerrainTiles(
        config.seed_dir / "sochi" / "dem.tif", config.terrain_cache_dir
    )
    web_research = PublicWebResearch()
    conditions = MetNorwayConditions(config.public_data_user_agent)
    events = PublicEvents(web_research)
    biodiversity = GBIFObservations()
    photos = CommonsPhotos(config.public_data_user_agent)
    landcover = WorldCover()
    places: dict[str, PlaceResearchPort] = {
        "search_events": events,
        "read_event_page": events,
        "observe_wildlife": biodiversity,
        "find_photos": photos,
        "measure_landcover": landcover,
    }
    geography_source = OverpassGeography(config.geography_api_url)
    geography = EnsureGeography(providers.uow, geography_source, providers.clock, logger)
    view_geometry = OSMViewGeometry(
        config.terrain_cache_dir.parent / "view-geometry" if config.terrain_cache_dir else None,
        context=geography,
    )
    embedder = (
        CachedEmbeddings(
            PolzaEmbeddings(
                config.embedding_api_key, config.embedding_model, config.embedding_base_url
            )
        )
        if config.embedding_api_key
        else None
    )
    semantic = SemanticSearch(
        providers.uow,
        DocumentIndex(config.seed_dir.parent / "raw" / "semantic", config.embedding_model),
        embedder,
        logger,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.providers = providers
        try:
            yield
        finally:
            if embedder:
                await embedder.aclose()
            await web_research.aclose()
            await conditions.aclose()
            await geography_source.aclose()
            await events.aclose()
            await biodiversity.aclose()
            await photos.aclose()
            await view_geometry.aclose()
            terrain_tiles.close()
            await providers.aclose()

    map_files = ManifestFiles(config.seed_dir, config.map_basemaps_dir)
    app = FastAPI(title="Hotel Agent API", version="0.1.0", lifespan=lifespan)
    ErrorHandlers(logger).register(app)
    get_hotel_offers = GetHotelOffers(
        providers.uow,
        providers.hotel_offers,
        providers.clock,
        providers.catalog_matcher,
        search_provider=providers.hotel_offer_search,
        card_lookup=WebHotelCard(web_research),
    )
    get_hotel_details = GetHotelDetails(providers.uow, providers.hotel_offer_search)
    semantic_review = SemanticReview(providers.llm, logger)
    verdict_review = SemanticReview(providers.llm, logger, first=providers.review_llm)
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
            semantic,
            web_research,
            conditions,
            NearbyViewAssessment(terrain_tiles, providers.uow),
            get_hotel_offers,
            NuiteeCatalog(config.nuitee_api_key)
            if config.nuitee_api_key
            and providers.hotel_offers is not None
            and providers.hotel_offers.supplier == "nuitee"
            else None,
            places=places,
            details=get_hotel_details,
        ),
        SearchAreas(config.seed_dir / "russia-admin1.geojson"),
        semantic,
        EvaluateWindowViews(providers.uow, WindowViews(terrain_tiles, view_geometry)),
        RecommendationReview(verdict_review),
        landmark_review=semantic_review,
        geographic_objects=GeographicObjects(view_geometry),
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
                lambda outcome, took_ms: search_schema(
                    outcome, providers.registry, took_ms
                ).model_dump(mode="json"),
                providers.registry,
                GetHotelCard(providers.uow, providers.clock),
                providers.clock,
                review=ChatAnswerReview(semantic_review),
            ),
            registry=providers.registry,
            get_geo_features=GetGeoFeatures(providers.uow),
            get_hotel_card=GetHotelCard(providers.uow, providers.clock),
            get_place=GetPlace(providers.uow, providers.clock),
            compare_hotels=CompareHotels(providers.uow, providers.registry, providers.clock),
            get_hotel_offers=get_hotel_offers,
            get_hotel_details=get_hotel_details,
            get_hotel_scene=GetHotelScene(providers.uow, geography),
            get_map_tile=GetMapTile(providers.uow, geography),
            get_map_catalog=GetMapCatalog(
                load_catalog(
                    config.map_catalog_dir or Path(__file__).resolve().parents[3] / "map-catalog"
                )
            ),
            get_terrain_tile=GetTerrainTile(terrain_tiles),
            get_weather=GetWeather(conditions),
            get_fact=GetFact(providers.uow),
            list_hotelier_questions=ListHotelierQuestions(providers.uow),
            answer_hotelier_question=AnswerHotelierQuestion(
                providers.uow, providers.registry, providers.llm, providers.clock, new_id
            ),
            change_question_status=ChangeQuestionStatus(providers.uow),
            change_facts=ChangeFacts(providers.uow, providers.registry, providers.clock, new_id),
            get_map_style=GetMapStyle(providers.uow, map_files, CATALOG_VERSION),
            get_map_scene=GetMapScene(providers.uow, map_files),
        )
    )
    return app


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"
