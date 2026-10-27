from collections.abc import Callable, Mapping, Sequence
from typing import Protocol, Self

from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.dto import (
    BuildingRecord,
    FacadeRecord,
    GeoFeatureRecord,
    NamedPlaceRecord,
    RegionRecord,
    SearchFactRecord,
    SearchHotelRecord,
    SupplierContentRecord,
)
from hotel_agent.application.ports.data_exploration import DataRepository
from hotel_agent.application.ports.places import PlaceRepository
from hotel_agent.application.ports.semantic_search import SearchDocumentsPort
from hotel_agent.application.ports.view_scenes import ViewSceneRepository
from hotel_agent.application.ports.walk import WalkRouterPort
from hotel_agent.application.room_records import RoomRecord
from hotel_agent.domain.query import NearbyObjectRequest


class RegionRepository(Protocol):
    async def list_loaded(self) -> Sequence[RegionRecord]: ...

    async def city_bbox(self, city: str) -> tuple[float, float, float, float] | None: ...
    async def city_center(self, city: str) -> tuple[float, float] | None: ...


class NamedPlaceRepository(Protocol):
    async def candidates(
        self,
        name: str,
        bbox: tuple[float, float, float, float],
        target_key: str | None = None,
        target_values: Sequence[str] = (),
    ) -> Sequence[NamedPlaceRecord]: ...

    async def geographic_name(self, name: str) -> NamedPlaceRecord | None: ...

    async def by_name(
        self,
        name: str,
        bbox: tuple[float, float, float, float],
        target_key: str | None = None,
        target_values: Sequence[str] = (),
    ) -> NamedPlaceRecord | None: ...

    async def near_coordinate(
        self, location: tuple[float, float], bbox: tuple[float, float, float, float]
    ) -> NamedPlaceRecord | None: ...


class CoastlineRepository(Protocol):
    async def nearest_points(
        self, hotel_ids: Sequence[str]
    ) -> Mapping[str, tuple[float, float]]: ...


class SearchRepository(Protocol):
    async def save_facts(self, records: Sequence[SearchFactRecord]) -> None: ...
    async def by_ids(self, hotel_ids: Sequence[str]) -> Sequence[SearchHotelRecord]: ...
    async def get_supplier_content(self, hotel_id: str) -> SupplierContentRecord | None: ...
    async def list_supplier_content(self, region: str) -> Sequence[SupplierContentRecord]: ...
    async def list_rooms(self, hotel_id: str) -> Sequence[RoomRecord]: ...
    async def get_supplier_id(self, hotel_id: str, supplier: str) -> str | None: ...
    async def nearby_city(self, location: tuple[float, float], radius_m: float) -> str | None: ...
    async def list_hotels(
        self, region: str, bbox: tuple[float, float, float, float] | None
    ) -> Sequence[SearchHotelRecord]: ...

    async def list_facts(
        self,
        region: str | None,
        hotel_id: str | None = None,
        hotel_ids: Sequence[str] | None = None,
        characteristic_keys: Sequence[str] | None = None,
    ) -> Sequence[SearchFactRecord]: ...

    async def get_hotel(self, hotel_id: str) -> SearchHotelRecord | None: ...

    async def list_facades(self, hotel_id: str) -> Sequence[FacadeRecord]: ...

    async def list_context_buildings(
        self, hotel_id: str, radius_m: float
    ) -> Sequence[BuildingRecord]: ...


class GeoFeatureRepository(Protocol):
    async def get_batch(self, ids: Sequence[str]) -> Sequence[GeoFeatureRecord]: ...
    async def save_batch(self, records: Sequence[GeoFeatureRecord]) -> None: ...


class MapTileRepository(Protocol):
    async def get(self, z: int, x: int, y: int) -> bytes: ...


class NearbyObjectRepository(Protocol):
    async def list_matches(
        self,
        region: str,
        request: NearbyObjectRequest,
        bbox: tuple[float, float, float, float] | None = None,
    ) -> Mapping[str, tuple[str, ...]]: ...


class ChatRepository(Protocol):
    async def get(self, conversation_id: str) -> ConversationRecord | None: ...

    async def save(
        self,
        conversation_id: str,
        region_id: str,
        effective_query: str | None,
        user_message_id: str,
        user_text: str,
        answer_id: str,
        answer: str,
        search_snapshot: dict[str, object] | None,
        title: str | None = None,
    ) -> None: ...

    async def save_search_snapshot(
        self, conversation_id: str, search_snapshot: dict[str, object]
    ) -> None: ...

    async def rename(self, conversation_id: str, title: str) -> bool: ...

    async def delete(self, conversation_id: str) -> bool: ...


class UnitOfWork(Protocol):
    walk: WalkRouterPort
    places: PlaceRepository
    view_scenes: ViewSceneRepository
    documents: SearchDocumentsPort
    chat: ChatRepository
    regions: RegionRepository
    search: SearchRepository
    geo_features: GeoFeatureRepository
    map_tiles: MapTileRepository
    nearby_objects: NearbyObjectRepository
    named_places: NamedPlaceRepository
    coastlines: CoastlineRepository
    data: DataRepository

    async def __aenter__(self) -> Self: ...

    async def __aexit__(self, *exc: object) -> None: ...

    async def commit(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]
