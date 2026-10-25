from collections.abc import Callable, Mapping, Sequence
from typing import Protocol, Self

from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.dto import (
    BuildingRecord,
    FacadeRecord,
    GeoFeatureRecord,
    RegionRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.room_records import RoomRecord
from hotel_agent.domain.query import NearbyObjectRequest


class RegionRepository(Protocol):
    async def list_loaded(self) -> Sequence[RegionRecord]: ...


class SearchRepository(Protocol):
    async def list_rooms(self, hotel_id: str) -> Sequence[RoomRecord]: ...
    async def get_supplier_id(self, hotel_id: str, supplier: str) -> str | None: ...
    async def list_hotels(
        self, region: str, bbox: tuple[float, float, float, float] | None
    ) -> Sequence[SearchHotelRecord]: ...

    async def list_facts(self, region: str) -> Sequence[SearchFactRecord]: ...

    async def get_hotel(self, hotel_id: str) -> SearchHotelRecord | None: ...

    async def list_facades(self, hotel_id: str) -> Sequence[FacadeRecord]: ...

    async def list_context_buildings(
        self, hotel_id: str, radius_m: float
    ) -> Sequence[BuildingRecord]: ...


class GeoFeatureRepository(Protocol):
    async def get_batch(self, ids: Sequence[str]) -> Sequence[GeoFeatureRecord]: ...


class MapTileRepository(Protocol):
    async def get(self, z: int, x: int, y: int) -> bytes: ...


class NearbyObjectRepository(Protocol):
    async def list_matches(
        self, region: str, request: NearbyObjectRequest
    ) -> Mapping[str, tuple[str, ...]]: ...


class ChatRepository(Protocol):
    async def get(self, conversation_id: str) -> ConversationRecord | None: ...

    async def save(
        self,
        conversation_id: str,
        region_id: str,
        effective_query: str,
        user_message_id: str,
        user_text: str,
        answer_id: str,
        answer: str,
        search_snapshot: dict[str, object],
    ) -> None: ...

    async def save_search_snapshot(
        self, conversation_id: str, search_snapshot: dict[str, object]
    ) -> None: ...


class UnitOfWork(Protocol):
    chat: ChatRepository
    regions: RegionRepository
    search: SearchRepository
    geo_features: GeoFeatureRepository
    map_tiles: MapTileRepository
    nearby_objects: NearbyObjectRepository

    async def __aenter__(self) -> Self: ...

    async def __aexit__(self, *exc: object) -> None: ...

    async def commit(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]
