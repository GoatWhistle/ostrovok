import json
import re
from collections.abc import Sequence

from psycopg import AsyncConnection

from hotel_agent.application.dto import GeoFeatureRecord

GET_BATCH = """SELECT g.id, g.kind, g.characteristic_key, ST_AsGeoJSON(g.geometry),
    g.name, g.label, g.osm_ref, g.style_hint
FROM unnest(%(ids)s::text[]) WITH ORDINALITY AS wanted(id, position)
JOIN geo_features g ON g.id = wanted.id ORDER BY wanted.position"""

GET_POIS = """SELECT 'g_poi_' || p.id, 'poi', 'spatial', ST_AsGeoJSON(p.location),
    p.tags->>'name', p.tags->>'name', p.id, 'points'
FROM pois p WHERE p.id = ANY(%(ids)s::text[])"""

POINT_REF = re.compile(r"^g_point_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$")


class PostgresGeoFeatureRepository:
    def __init__(self, connection: AsyncConnection[tuple[object, ...]]) -> None:
        self._connection = connection

    async def get_batch(self, ids: Sequence[str]) -> Sequence[GeoFeatureRecord]:
        result = await self._connection.execute(GET_BATCH, {"ids": list(ids)})
        rows = list(await result.fetchall())
        found = {str(row[0]) for row in rows}
        missing_pois = [
            item.removeprefix("g_poi_")
            for item in ids
            if item.startswith("g_poi_") and item not in found
        ]
        if missing_pois:
            result = await self._connection.execute(GET_POIS, {"ids": missing_pois})
            rows.extend(await result.fetchall())
        features = [
            GeoFeatureRecord(
                id=str(row[0]),
                kind=str(row[1]),
                characteristic_key=str(row[2]),
                geometry=json.loads(str(row[3])),
                name=str(row[4]) if row[4] is not None else None,
                label=str(row[5]) if row[5] is not None else None,
                osm_ref=str(row[6]) if row[6] is not None else None,
                style_hint=str(row[7]) if row[7] is not None else None,
            )
            for row in rows
        ]
        for item in ids:
            match = POINT_REF.fullmatch(item)
            if match is None:
                continue
            lon, lat = float(match[1]), float(match[2])
            if not -180 <= lon <= 180 or not -90 <= lat <= 90:
                continue
            features.append(
                GeoFeatureRecord(
                    id=item,
                    kind="poi",
                    characteristic_key="spatial",
                    geometry={"type": "Point", "coordinates": [lon, lat]},
                    name="Приблизительный центр города",
                    label=None,
                    osm_ref=None,
                    style_hint="points",
                )
            )
        ordered = {item.id: item for item in features}
        return [ordered[item] for item in ids if item in ordered]
