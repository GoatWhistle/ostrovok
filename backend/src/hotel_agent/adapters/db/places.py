import json
import re
from datetime import UTC, date, datetime, time
from functools import lru_cache
from pathlib import Path

from psycopg import AsyncConnection

from hotel_agent.application.ports.places import PlaceRecord

PLACE = """SELECT p.id,ST_X(p.location),ST_Y(p.location),p.tags,p.region_id,r.built_at::date
FROM pois p JOIN regions r ON r.id=p.region_id WHERE p.id=%(id)s"""


@lru_cache(maxsize=32)
def snapshot_date(directory: Path, region: str, fallback: date) -> datetime:
    if re.fullmatch(r"[a-z0-9_-]+", region):
        path = directory / region / "meta.json"
        if path.is_file():
            meta = json.loads(path.read_text())
            timestamp = meta.get("extracted_at", meta.get("built_at"))
            if isinstance(timestamp, str):
                parsed = datetime.fromisoformat(timestamp)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return datetime.combine(fallback, time(), UTC)


class PostgresPlaceRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]], seed_dir: Path) -> None:
        self._connection = connection
        self._seed_dir = seed_dir

    async def get(self, place_id: str) -> PlaceRecord | None:
        row = await (await self._connection.execute(PLACE, {"id": place_id})).fetchone()
        if row is None:
            return None
        assert isinstance(row[5], date)
        return PlaceRecord(
            id=str(row[0]),
            location=(float(str(row[1])), float(str(row[2]))),
            tags={str(key): str(value) for key, value in row[3].items()}
            if isinstance(row[3], dict)
            else {},
            extracted_at=snapshot_date(self._seed_dir, str(row[4]), row[5]),
        )
