import json
from collections.abc import Sequence
from datetime import datetime

from psycopg import AsyncConnection

from hotel_agent.application.dto import (
    BuildingRecord,
    FacadeRecord,
    SearchFactRecord,
    SearchHotelRecord,
)

HOTEL_COLUMNS = """SELECT h.id, h.name, ST_X(h.location), ST_Y(h.location), h.stars,
    h.building_id, b.height_m, b.levels, ST_AsGeoJSON(b.footprint), h.region_id,
    NULLIF(concat_ws(' ', h.tags->>'addr:street', h.tags->>'addr:housenumber'), '')
FROM hotels h LEFT JOIN buildings b ON b.id = h.building_id """

HOTELS = (
    HOTEL_COLUMNS
    + """WHERE h.region_id = %(region)s AND h.name <> h.id
  AND (%(bbox)s::double precision[] IS NULL OR ST_Intersects(h.location,
      ST_MakeEnvelope((%(bbox)s::double precision[])[1], (%(bbox)s::double precision[])[2],
                      (%(bbox)s::double precision[])[3], (%(bbox)s::double precision[])[4], 4326)))
ORDER BY h.id"""
)

HOTEL_BY_ID = HOTEL_COLUMNS + "WHERE h.id = %(hotel_id)s"

FACADES = """SELECT id, azimuth_deg, label, ST_AsGeoJSON(geometry)
FROM facades WHERE hotel_id = %(hotel_id)s ORDER BY id"""

CONTEXT_BUILDINGS = """SELECT b.id, ST_AsGeoJSON(b.footprint), b.height_m, b.levels
FROM hotels h JOIN buildings b
  ON b.region_id = h.region_id AND b.id <> h.building_id
 AND ST_DWithin(b.footprint::geography, h.location::geography, %(radius)s)
WHERE h.id = %(hotel_id)s
ORDER BY b.footprint <-> h.location LIMIT 150"""

FACTS = """SELECT h.id, f.id, f.characteristic_key, f.value, f.unit, f.qualifiers,
    f.source_type, f.source_id, f.method, f.confidence, f.computed_at, f.valid_until,
    f.status, f.geo_refs, f.explanation, NULL::double precision
FROM facts f JOIN hotels h ON h.id = f.subject_id
WHERE h.region_id = %(region)s AND f.subject_type = 'hotel'
  AND f.status IN ('active', 'confirmed_by_hotelier')
UNION ALL
SELECT fa.hotel_id, f.id, f.characteristic_key, f.value, f.unit, f.qualifiers,
    f.source_type, f.source_id, f.method, f.confidence, f.computed_at, f.valid_until,
    f.status, f.geo_refs, f.explanation, fa.azimuth_deg
FROM facts f JOIN facades fa ON fa.id = f.subject_id
JOIN hotels h ON h.id = fa.hotel_id
WHERE h.region_id = %(region)s AND f.subject_type = 'facade'
  AND f.status IN ('active', 'confirmed_by_hotelier')"""


class PostgresSearchRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def list_hotels(
        self, region: str, bbox: tuple[float, float, float, float] | None
    ) -> Sequence[SearchHotelRecord]:
        result = await self._connection.execute(
            HOTELS, {"region": region, "bbox": list(bbox) if bbox else None}
        )
        rows = await result.fetchall()
        return [_hotel(row) for row in rows]

    async def get_hotel(self, hotel_id: str) -> SearchHotelRecord | None:
        result = await self._connection.execute(HOTEL_BY_ID, {"hotel_id": hotel_id})
        row = await result.fetchone()
        return _hotel(row) if row else None

    async def list_facades(self, hotel_id: str) -> Sequence[FacadeRecord]:
        result = await self._connection.execute(FACADES, {"hotel_id": hotel_id})
        rows = await result.fetchall()
        return [
            FacadeRecord(
                id=str(row[0]),
                azimuth_deg=float(str(row[1])),
                label=str(row[2]),
                geometry=json.loads(str(row[3])),
            )
            for row in rows
        ]

    async def list_context_buildings(
        self, hotel_id: str, radius_m: float
    ) -> Sequence[BuildingRecord]:
        result = await self._connection.execute(
            CONTEXT_BUILDINGS, {"hotel_id": hotel_id, "radius": radius_m}
        )
        rows = await result.fetchall()
        return [
            BuildingRecord(
                id=str(row[0]),
                geometry=json.loads(str(row[1])),
                height_m=float(str(row[2])) if row[2] is not None else None,
                levels=int(str(row[3])) if row[3] is not None else None,
            )
            for row in rows
        ]

    async def list_facts(self, region: str) -> Sequence[SearchFactRecord]:
        result = await self._connection.execute(FACTS, {"region": region})
        rows = await result.fetchall()
        records = []
        for row in rows:
            assert isinstance(row[10], datetime)
            assert row[11] is None or isinstance(row[11], datetime)
            records.append(
                SearchFactRecord(
                    hotel_id=str(row[0]),
                    id=str(row[1]),
                    characteristic_key=str(row[2]),
                    value=row[3],
                    unit=str(row[4]) if row[4] is not None else None,
                    qualifiers=dict(row[5]) if isinstance(row[5], dict) else {},
                    source_type=str(row[6]),
                    source_id=str(row[7]) if row[7] is not None else None,
                    method=str(row[8]),
                    confidence=float(str(row[9])),
                    computed_at=row[10],
                    valid_until=row[11],
                    status=str(row[12]),
                    geo_refs=tuple(str(ref) for ref in row[13])
                    if isinstance(row[13], list | tuple)
                    else (),
                    explanation=str(row[14]),
                    facade_azimuth=float(str(row[15])) if row[15] is not None else None,
                )
            )
        return records


def _hotel(row: tuple[object, ...]) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=str(row[0]),
        name=str(row[1]),
        location=(float(str(row[2])), float(str(row[3]))),
        stars=int(str(row[4])) if row[4] is not None else None,
        building_id=str(row[5]) if row[5] is not None else None,
        height_m=float(str(row[6])) if row[6] is not None else None,
        levels=int(str(row[7])) if row[7] is not None else None,
        footprint=json.loads(str(row[8])) if row[8] is not None else None,
        region_id=str(row[9]),
        address=str(row[10]) if row[10] is not None else None,
    )
