import json
from collections.abc import Sequence
from datetime import datetime

from psycopg import AsyncConnection

from hotel_agent.adapters.db.derived_facts import save_derived_facts
from hotel_agent.adapters.db.hotel_media import read_hotel_photos
from hotel_agent.adapters.db.search_facts import FACTS, fact_record
from hotel_agent.application.dto import (
    BuildingRecord,
    FacadeRecord,
    SearchFactRecord,
    SearchHotelRecord,
    SupplierContentRecord,
)
from hotel_agent.application.room_records import RoomRecord

HOTEL_COLUMNS = """SELECT h.id, h.name, ST_X(h.location), ST_Y(h.location), h.stars,
    h.building_id, b.height_m, b.levels, ST_AsGeoJSON(b.footprint), h.region_id,
    NULLIF(concat_ws(' ', h.tags->>'addr:street', h.tags->>'addr:housenumber'), ''),
    h.tags->>'addr:city', h.tags,
    (SELECT jsonb_agg(jsonb_build_object('photos',c.details->'photos',
        'hotelImages',c.details->'hotelImages','source_url',c.details->'source_url')
        ORDER BY c.updated_at DESC,c.supplier)
     FROM hotel_supplier_content c WHERE c.hotel_id=h.id)
FROM hotels h LEFT JOIN buildings b ON b.id = h.building_id """

HOTELS = (
    HOTEL_COLUMNS
    + """WHERE h.region_id = %(region)s AND h.name <> h.id
  AND translate(lower(h.name), 'ё', 'е') NOT LIKE '%%общежити%%'
  AND (%(bbox)s::double precision[] IS NULL OR ST_Intersects(h.location,
      ST_MakeEnvelope((%(bbox)s::double precision[])[1], (%(bbox)s::double precision[])[2],
                      (%(bbox)s::double precision[])[3], (%(bbox)s::double precision[])[4], 4326)))
ORDER BY h.id"""
)

HOTEL_BY_ID = HOTEL_COLUMNS + "WHERE h.id = %(hotel_id)s"

NEARBY_CITY = """SELECT h.tags->>'addr:city'
FROM hotels h
WHERE h.tags ? 'addr:city'
  AND ST_DWithin(h.location::geography,
      ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, %(radius)s)
ORDER BY h.location::geography <-> ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography
LIMIT 1"""

FACADES = """SELECT id, azimuth_deg, label, ST_AsGeoJSON(geometry)
FROM facades WHERE hotel_id = %(hotel_id)s ORDER BY id"""

CONTEXT_BUILDINGS = """SELECT b.id, ST_AsGeoJSON(b.footprint),
COALESCE(b.height_m,
    CASE WHEN (b.tags->>'building:levels') ~ '^[0-9]{1,2}$'
        THEN LEAST((b.tags->>'building:levels')::integer, 60) * 3.2 END,
    CASE WHEN b.levels IS NOT NULL THEN b.levels * 3.2 END,
    3.2),
COALESCE(b.levels,
    CASE WHEN (b.tags->>'building:levels') ~ '^[0-9]{1,2}$'
        THEN LEAST((b.tags->>'building:levels')::integer, 60) END),
b.height_m IS NULL
FROM hotels h JOIN buildings b
  ON (h.building_id IS NULL OR b.id <> h.building_id)
 AND ST_DWithin(b.footprint::geography, h.location::geography, %(radius)s)
WHERE h.id = %(hotel_id)s
ORDER BY b.footprint <-> h.location"""

ROOMS = """SELECT id, name, capacity, floor_min, floor_max, facade_ids,
price_amount, price_currency, included FROM rooms WHERE hotel_id = %(hotel_id)s ORDER BY id"""


class PostgresSearchRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def save_facts(self, records: Sequence[SearchFactRecord]) -> None:
        await save_derived_facts(self._connection, records)

    async def by_ids(self, hotel_ids: Sequence[str]) -> Sequence[SearchHotelRecord]:
        cursor = await self._connection.execute(
            HOTEL_COLUMNS + "WHERE h.id=ANY(%(ids)s::text[]) AND h.name<>h.id "
            "AND translate(lower(h.name), 'ё', 'е') NOT LIKE '%%общежити%%'",
            {"ids": list(hotel_ids)},
        )
        return [_hotel(row) for row in await cursor.fetchall()]

    async def get_supplier_content(self, hotel_id: str) -> SupplierContentRecord | None:
        row = await (
            await self._connection.execute(
                """SELECT hotel_id, supplier, facilities_ru, facilities_en, updated_at
                FROM hotel_supplier_content WHERE hotel_id = %(hotel_id)s
                ORDER BY updated_at DESC LIMIT 1""",
                {"hotel_id": hotel_id},
            )
        ).fetchone()
        return _supplier_content(row) if row else None

    async def list_supplier_content(self, region: str) -> Sequence[SupplierContentRecord]:
        rows = await (
            await self._connection.execute(
                """SELECT c.hotel_id, c.supplier, c.facilities_ru, c.facilities_en, c.updated_at
                FROM hotel_supplier_content c JOIN hotels h ON h.id = c.hotel_id
                WHERE h.region_id = %(region)s""",
                {"region": region},
            )
        ).fetchall()
        return [_supplier_content(row) for row in rows]

    async def nearby_city(self, location: tuple[float, float], radius_m: float) -> str | None:
        result = await self._connection.execute(
            NEARBY_CITY,
            {
                "lon": location[0],
                "lat": location[1],
                "radius": radius_m,
            },
        )
        row = await result.fetchone()
        return str(row[0]) if row else None

    async def get_supplier_id(self, hotel_id: str, supplier: str) -> str | None:
        result = await self._connection.execute(
            "SELECT supplier_id FROM hotel_supplier_refs WHERE hotel_id = %(hotel_id)s "
            "AND supplier = %(supplier)s",
            {"hotel_id": hotel_id, "supplier": supplier},
        )
        row = await result.fetchone()
        return str(row[0]) if row else None

    async def list_rooms(self, hotel_id: str) -> Sequence[RoomRecord]:
        rows = await (await self._connection.execute(ROOMS, {"hotel_id": hotel_id})).fetchall()
        return [
            RoomRecord(
                id=str(row[0]),
                name=str(row[1]),
                capacity=int(str(row[2])),
                floor_min=int(str(row[3])) if row[3] is not None else None,
                floor_max=int(str(row[4])) if row[4] is not None else None,
                facade_ids=tuple(str(item) for item in row[5]) if isinstance(row[5], list) else (),
                price_amount=float(str(row[6])) if row[6] is not None else None,
                price_currency=str(row[7]) if row[7] is not None else None,
                included=tuple(str(item) for item in row[8]) if isinstance(row[8], list) else (),
            )
            for row in rows
        ]

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
                height_estimated=bool(row[4]),
            )
            for row in rows
        ]

    async def list_facts(
        self,
        region: str | None,
        hotel_id: str | None = None,
        hotel_ids: Sequence[str] | None = None,
        characteristic_keys: Sequence[str] | None = None,
    ) -> Sequence[SearchFactRecord]:
        result = await self._connection.execute(
            FACTS,
            {
                "region": region,
                "hotel_id": hotel_id,
                "hotel_ids": list(hotel_ids) if hotel_ids is not None else None,
                "characteristic_keys": list(characteristic_keys)
                if characteristic_keys is not None
                else None,
            },
        )
        rows = await result.fetchall()
        return [fact_record(row) for row in rows]


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
        city=str(row[11]) if row[11] is not None else None,
        photos=read_hotel_photos(row[12], row[13], str(row[0])),
    )


def _supplier_content(row: tuple[object, ...]) -> SupplierContentRecord:
    assert isinstance(row[4], datetime)
    return SupplierContentRecord(
        hotel_id=str(row[0]),
        supplier=str(row[1]),
        facilities_ru=tuple(str(item) for item in row[2])
        if isinstance(row[2], list | tuple)
        else (),
        facilities_en=tuple(str(item) for item in row[3])
        if isinstance(row[3], list | tuple)
        else (),
        updated_at=row[4],
    )
