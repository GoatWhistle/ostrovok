from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from hotel_agent.application.dto import (
    FeedCursor,
    NotificationCounters,
    NotificationPage,
    NotificationRecord,
)


class NotificationStore(Protocol):
    async def add(self, records: Sequence[NotificationRecord]) -> int: ...

    async def page(
        self,
        hotel_id: str,
        *,
        unread_only: bool = False,
        cursor: FeedCursor | None = None,
        limit: int = 50,
    ) -> NotificationPage: ...

    async def unread_counts(self, hotel_id: str) -> NotificationCounters: ...

    async def mark_read(self, hotel_id: str, ids: Sequence[str], now: datetime) -> int: ...

    async def mark_all_read(self, hotel_id: str, now: datetime) -> int: ...
