from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class HotelierEntry:
    id: str
    hotel_id: str
    title: str
    description: str
    updated_at: datetime


class HotelierEntries(Protocol):
    async def for_hotel(self, hotel_id: str) -> Sequence[HotelierEntry]: ...

    async def save(self, entry: HotelierEntry) -> None: ...
