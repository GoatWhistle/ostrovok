from collections.abc import Sequence
from typing import Any

from psycopg import AsyncConnection

QUERIES = {
    "onsite_objects": """SELECT jsonb_build_object('hotel_id',h.id,'id',p.id,
        'relation','within_hotel_building','tags',p.tags,'source','OpenStreetMap',
        'geo_ref','g_poi_' || p.id) FROM hotels h JOIN buildings b ON b.id=h.building_id
        JOIN pois p ON ST_Covers(b.footprint,p.location)
        WHERE h.id=ANY(%(ids)s::text[]) ORDER BY h.id,p.id LIMIT 5000""",
    "documents": """SELECT jsonb_build_object('hotel_id',hotel_id,'id',id,
        'text',text,'source',source) FROM hotel_search_documents
        WHERE hotel_id=ANY(%(ids)s::text[]) ORDER BY hotel_id,id LIMIT 5000""",
    "hotels": """SELECT jsonb_build_object(
        'hotel_id',h.id,'name',h.name,'stars',h.stars,'tags',h.tags,
        'longitude',ST_X(h.location),'latitude',ST_Y(h.location),
        'building_height_m',b.height_m,'building_levels',b.levels)
        FROM hotels h LEFT JOIN buildings b ON b.id=h.building_id
        WHERE h.id=ANY(%(ids)s::text[]) ORDER BY h.id LIMIT 5000""",
    "rooms": """SELECT jsonb_build_object(
        'hotel_id',hotel_id,'id',id,'name',name,'capacity',capacity,
        'floor_min',floor_min,'floor_max',floor_max,'price_amount',price_amount,
        'price_currency',price_currency,'included',included,'details',details)
        FROM rooms WHERE hotel_id=ANY(%(ids)s::text[]) ORDER BY hotel_id,id LIMIT 5000""",
    "facilities": """SELECT jsonb_build_object(
        'hotel_id',c.hotel_id,'name',f.name,'supplier',c.supplier)
        FROM hotel_supplier_content c
        CROSS JOIN LATERAL unnest(c.facilities_ru || c.facilities_en) f(name)
        WHERE c.hotel_id=ANY(%(ids)s::text[]) ORDER BY c.hotel_id,f.name LIMIT 5000""",
}


class PostgresDataRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def records(self, dataset: str, hotel_ids: Sequence[str]) -> Sequence[dict[str, Any]]:
        if dataset not in QUERIES:
            raise ValueError("Dataset is not available for data exploration")
        rows = await (
            await self._connection.execute(QUERIES[dataset], {"ids": list(hotel_ids)})
        ).fetchall()
        return [dict(row[0]) for row in rows if isinstance(row[0], dict)]
