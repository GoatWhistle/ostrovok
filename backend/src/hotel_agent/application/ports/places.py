from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class PlaceRecord:
    id: str
    location: tuple[float, float]
    tags: dict[str, str]
    extracted_at: datetime


class PlaceRepository(Protocol):
    async def get(self, place_id: str) -> PlaceRecord | None: ...
