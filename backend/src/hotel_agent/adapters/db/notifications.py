from collections.abc import Sequence
from datetime import datetime

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.application.dto import (
    FeedCursor,
    NotificationCounters,
    NotificationPage,
    NotificationRecord,
)

COLUMNS = """SELECT id, hotel_id, kind, severity, characteristic_key, question_id, fact_id,
    conflict_id, payload, dedup_key, created_at, read_at
FROM hotelier_notifications"""

FEED = (
    COLUMNS
    + """
WHERE hotel_id = %(hotel)s
  AND (NOT %(unread_only)s OR read_at IS NULL)
  AND (%(cursor_at)s::timestamptz IS NULL
       OR (created_at, id) < (%(cursor_at)s::timestamptz, %(cursor_id)s))
ORDER BY created_at DESC, id DESC
LIMIT %(limit)s"""
)

ADD = """INSERT INTO hotelier_notifications
    (id, hotel_id, kind, severity, characteristic_key, question_id, fact_id, conflict_id,
     payload, dedup_key, created_at, read_at)
VALUES (%(id)s, %(hotel)s, %(kind)s, %(severity)s, %(key)s, %(question)s, %(fact)s,
    %(conflict)s, %(payload)s, %(dedup)s, %(created_at)s, %(read_at)s)
ON CONFLICT DO NOTHING"""

UNREAD_COUNTS = """SELECT kind, severity, count(*)
FROM hotelier_notifications
WHERE hotel_id = %(hotel)s AND read_at IS NULL
GROUP BY kind, severity"""

MARK_READ = """UPDATE hotelier_notifications SET read_at = %(now)s
WHERE hotel_id = %(hotel)s AND read_at IS NULL AND id = ANY(%(ids)s)"""

MARK_ALL_READ = """UPDATE hotelier_notifications SET read_at = %(now)s
WHERE hotel_id = %(hotel)s AND read_at IS NULL"""


class PostgresNotificationStore:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def add(self, records: Sequence[NotificationRecord]) -> int:
        written = 0
        for record in records:
            cursor = await self._connection.execute(ADD, _params(record))
            written += max(cursor.rowcount, 0)
        return written

    async def page(
        self,
        hotel_id: str,
        *,
        unread_only: bool = False,
        cursor: FeedCursor | None = None,
        limit: int = 50,
    ) -> NotificationPage:
        result = await self._connection.execute(
            FEED,
            {
                "hotel": hotel_id,
                "unread_only": unread_only,
                "cursor_at": cursor.created_at if cursor else None,
                "cursor_id": cursor.id if cursor else None,
                "limit": limit + 1,
            },
        )
        rows = [_notification(row) for row in await result.fetchall()]
        if len(rows) <= limit:
            return NotificationPage(items=tuple(rows))
        last = rows[limit - 1]
        return NotificationPage(
            items=tuple(rows[:limit]),
            next_cursor=FeedCursor(created_at=last.created_at, id=last.id),
        )

    async def unread_counts(self, hotel_id: str) -> NotificationCounters:
        result = await self._connection.execute(UNREAD_COUNTS, {"hotel": hotel_id})
        by_kind: dict[str, int] = {}
        total, action = 0, 0
        for kind, severity, count in await result.fetchall():
            amount = int(str(count))
            by_kind[str(kind)] = by_kind.get(str(kind), 0) + amount
            total += amount
            if str(severity) == "action":
                action += amount
        return NotificationCounters(total=total, action=action, by_kind=by_kind)

    async def mark_read(self, hotel_id: str, ids: Sequence[str], now: datetime) -> int:
        if not ids:
            return 0
        cursor = await self._connection.execute(
            MARK_READ, {"hotel": hotel_id, "ids": list(ids), "now": now}
        )
        return max(cursor.rowcount, 0)

    async def mark_all_read(self, hotel_id: str, now: datetime) -> int:
        cursor = await self._connection.execute(MARK_ALL_READ, {"hotel": hotel_id, "now": now})
        return max(cursor.rowcount, 0)


def _params(record: NotificationRecord) -> dict[str, object]:
    return {
        "id": record.id,
        "hotel": record.hotel_id,
        "kind": record.kind,
        "severity": record.severity,
        "key": record.characteristic_key,
        "question": record.question_id,
        "fact": record.fact_id,
        "conflict": record.conflict_id,
        "payload": Jsonb(record.payload),
        "dedup": record.dedup_key,
        "created_at": record.created_at,
        "read_at": record.read_at,
    }


def _notification(row: tuple[object, ...]) -> NotificationRecord:
    payload = row[8] if isinstance(row[8], dict) else {}
    return NotificationRecord(
        id=str(row[0]),
        hotel_id=str(row[1]),
        kind=str(row[2]),
        severity=str(row[3]),
        characteristic_key=str(row[4]) if row[4] is not None else None,
        question_id=str(row[5]) if row[5] is not None else None,
        fact_id=str(row[6]) if row[6] is not None else None,
        conflict_id=str(row[7]) if row[7] is not None else None,
        payload=dict(payload),
        dedup_key=str(row[9]),
        created_at=_moment(row[10]),
        read_at=_moment(row[11]) if row[11] is not None else None,
    )


def _moment(value: object) -> datetime:
    assert isinstance(value, datetime)
    return value
