import json
from collections.abc import Sequence

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from hotel_agent.adapters.db.seed import TABLES
from hotel_agent.adapters.geo.building_dimensions import length_values
from hotel_agent.application.dto import Feature

HOTELS_SQL = """INSERT INTO hotels(id,region_id,name,location,stars,tags)
VALUES (%(id)s,%(region)s,%(name)s,ST_GeomFromGeoJSON(%(geometry)s),%(stars)s,%(tags)s)
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, location=EXCLUDED.location,
 stars=COALESCE(EXCLUDED.stars,hotels.stars), tags=hotels.tags || EXCLUDED.tags"""

BUILDINGS_SQL = """INSERT INTO buildings(id,region_id,footprint,tags,height_m,levels)
VALUES (%(id)s,%(region)s,ST_Multi(ST_GeomFromGeoJSON(%(geometry)s)),
 %(tags)s,%(height)s,%(levels)s)
ON CONFLICT(id) DO UPDATE SET footprint=EXCLUDED.footprint,
 tags=buildings.tags || EXCLUDED.tags,
 height_m=COALESCE(EXCLUDED.height_m,buildings.height_m),
 levels=COALESCE(EXCLUDED.levels,buildings.levels)"""


async def save_layer(
    connection: AsyncConnection[tuple[object, ...]],
    region: str,
    name: str,
    features: Sequence[Feature],
) -> None:
    rows = []
    for feature in features:
        row: dict[str, object] = {
            "id": feature.id,
            "region": region,
            "geometry": json.dumps(feature.geometry),
            "tags": Jsonb(feature.properties),
        }
        if name == "hotels":
            stars = feature.properties.get("stars", "")
            row.update(
                name=feature.properties.get("name", feature.id),
                stars=int(stars) if stars.isdecimal() and int(stars) <= 7 else None,
            )
        elif name == "buildings":
            heights = length_values(feature.properties.get("height"))
            levels = length_values(feature.properties.get("building:levels"))
            row.update(
                height=heights[0] if heights and len(set(heights)) == 1 else None,
                levels=int(max(levels))
                if levels and all(value.is_integer() and 1 <= value <= 200 for value in levels)
                else None,
            )
        rows.append(row)
    if name == "hotels":
        query = HOTELS_SQL
    elif name == "buildings":
        query = BUILDINGS_SQL
    else:
        table, column, _ = TABLES[name]
        geometry = "ST_GeomFromGeoJSON(%(geometry)s)"
        if name != "pois":
            geometry = f"ST_Multi({geometry})"
        query = f"""INSERT INTO {table}(id,region_id,{column},tags)
        VALUES (%(id)s,%(region)s,{geometry},%(tags)s)
        ON CONFLICT(id) DO UPDATE SET {column}=EXCLUDED.{column},
         tags={table}.tags || EXCLUDED.tags"""
    async with connection.cursor() as cursor:
        await cursor.executemany(query, rows)
