import asyncio
from pathlib import Path
from typing import Self

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.db.chat import PostgresChatRepository
from hotel_agent.adapters.db.coastlines import PostgresCoastlineRepository
from hotel_agent.adapters.db.data_exploration import PostgresDataRepository
from hotel_agent.adapters.db.geo_features import PostgresGeoFeatureRepository
from hotel_agent.adapters.db.map_tiles import PostgresMapTileRepository
from hotel_agent.adapters.db.named_places import PostgresNamedPlaceRepository
from hotel_agent.adapters.db.nearby_objects import PostgresNearbyObjectRepository
from hotel_agent.adapters.db.places import PostgresPlaceRepository
from hotel_agent.adapters.db.regions import PostgresRegionRepository
from hotel_agent.adapters.db.search import PostgresSearchRepository
from hotel_agent.adapters.db.search_documents import PostgresSearchDocuments
from hotel_agent.adapters.db.view_scenes import PostgresViewScenes
from hotel_agent.adapters.db.walk_router import PostgresWalkRouter, WalkRouteCache
from hotel_agent.application.ports.data_exploration import DataRepository
from hotel_agent.application.ports.places import PlaceRepository
from hotel_agent.application.ports.repositories import (
    ChatRepository,
    CoastlineRepository,
    GeoFeatureRepository,
    MapTileRepository,
    NamedPlaceRepository,
    NearbyObjectRepository,
    RegionRepository,
    SearchRepository,
)
from hotel_agent.application.ports.semantic_search import SearchDocumentsPort
from hotel_agent.application.ports.view_scenes import ViewSceneRepository
from hotel_agent.application.ports.walk import WalkRouterPort


class PostgresUnitOfWorkFactory:
    def __init__(self, database_url: str, seed_dir: Path = Path("data/seed")) -> None:
        self.seed_dir = seed_dir
        self._pool: AsyncConnectionPool[AsyncConnection[tuple[object, ...]]] = AsyncConnectionPool(
            database_url, min_size=1, max_size=5, open=False
        )
        self._open_lock = asyncio.Lock()
        self.walk_cache = WalkRouteCache()

    def __call__(self) -> "PostgresUnitOfWork":
        return PostgresUnitOfWork(self)

    async def connection(self) -> AsyncConnection[tuple[object, ...]]:
        if self._pool.closed:
            async with self._open_lock:
                if self._pool.closed:
                    await self._pool.open(wait=True)
        return await self._pool.getconn()

    async def release(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        await self._pool.putconn(connection)

    async def aclose(self) -> None:
        if not self._pool.closed:
            await self._pool.close()


class PostgresUnitOfWork:
    def __init__(self, factory: PostgresUnitOfWorkFactory) -> None:
        self._factory = factory
        self._connection: AsyncConnection[tuple[object, ...]] | None = None
        self.places: PlaceRepository
        self.walk: WalkRouterPort
        self.regions: RegionRepository
        self.search: SearchRepository
        self.geo_features: GeoFeatureRepository
        self.map_tiles: MapTileRepository
        self.nearby_objects: NearbyObjectRepository
        self.named_places: NamedPlaceRepository
        self.coastlines: CoastlineRepository
        self.data: DataRepository
        self.chat: ChatRepository
        self.documents: SearchDocumentsPort
        self.view_scenes: ViewSceneRepository

    async def __aenter__(self) -> Self:
        self._connection = await self._factory.connection()
        self.places = PostgresPlaceRepository(self._connection, self._factory.seed_dir)
        self.walk = PostgresWalkRouter(self._connection, self._factory.walk_cache)
        self.regions = PostgresRegionRepository(self._connection)
        self.search = PostgresSearchRepository(self._connection)
        self.geo_features = PostgresGeoFeatureRepository(self._connection)
        self.map_tiles = PostgresMapTileRepository(self._connection)
        self.nearby_objects = PostgresNearbyObjectRepository(self._connection)
        self.named_places = PostgresNamedPlaceRepository(self._connection)
        self.coastlines = PostgresCoastlineRepository(self._connection)
        self.data = PostgresDataRepository(self._connection)
        self.chat = PostgresChatRepository(self._connection)
        self.documents = PostgresSearchDocuments(self._connection)
        self.view_scenes = PostgresViewScenes(self._connection)
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._connection is not None:
            await self._connection.rollback()
            await self._factory.release(self._connection)
            self._connection = None

    async def commit(self) -> None:
        if self._connection is None:
            raise RuntimeError("Unit of work is not open")
        await self._connection.commit()
