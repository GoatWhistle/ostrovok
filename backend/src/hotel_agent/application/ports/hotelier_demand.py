from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from hotel_agent.application.dto import DemandRecord


class HotelierDemandPort(Protocol):
    async def for_hotel(self, hotel_id: str, since: datetime) -> Sequence[DemandRecord]: ...

    async def appearances(self, hotel_id: str, since: datetime) -> int: ...

    async def unknown_counts(
        self,
        region: str,
        characteristic_keys: Sequence[str],
        since: datetime,
        limit: int = 2000,
    ) -> Sequence[DemandRecord]: ...
