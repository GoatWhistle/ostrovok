from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchDocument:
    id: str
    hotel_id: str
    text: str
    source: str
    relevance: float = 0.0


class SemanticSearchPort(Protocol):
    async def search(
        self, query: str, hotel_ids: Sequence[str] | None = None, limit: int = 100
    ) -> Sequence[SearchDocument]: ...


class SearchDocumentsPort(Protocol):
    async def list(self, hotel_ids: Sequence[str] | None = None) -> Sequence[SearchDocument]: ...
