import json
from collections import Counter
from collections.abc import Sequence

from psycopg import Connection
from psycopg.types.json import Jsonb

from hotel_agent.adapters.geo.building_dimensions import length_values
from hotel_agent.application.dto import Feature
from hotel_agent.application.map_catalog import MapCatalog

BUILDINGS = """SELECT b.id,b.tags,(b.hotel_id IS NOT NULL OR EXISTS (SELECT 1 FROM hotels h WHERE h.region_id=b.region_id AND (h.building_id=b.id OR (h.location && b.footprint AND ST_Covers(b.footprint,h.location))))),ST_Area(b.footprint::geography),b.levels,
COALESCE((SELECT jsonb_agg(p.tags ORDER BY p.id) FROM pois p
WHERE p.region_id=b.region_id AND p.location && b.footprint AND ST_Covers(b.footprint,p.location)), '[]'),
(SELECT l.tags->>'landuse' FROM landcover l WHERE l.region_id=b.region_id
 AND l.geometry && b.footprint AND ST_Covers(l.geometry,ST_Centroid(b.footprint))
 AND l.tags ? 'landuse' ORDER BY ST_Area(l.geometry),l.id LIMIT 1)
FROM buildings b WHERE b.region_id=%s"""


class PostgresMapImporter:
    def __init__(self, connection: Connection[tuple[object, ...]]) -> None:
        self._connection = connection

    def import_layers(
        self, region: str, features: Sequence[Feature], catalog: MapCatalog
    ) -> dict[str, int]:
        counts: Counter[str] = Counter()
        with self._connection.transaction(), self._connection.cursor() as cursor:
            for feature in features:
                tags = {str(k): str(v) for k, v in feature.properties.items()}
                geometry = feature.geometry["type"]
                if geometry == "Point" and tags.get("natural") == "tree":
                    table, layer = "trees", "prop"
                elif geometry == "MultiPolygon" and not tags.get("building"):
                    water = tags.get("natural") == "water" or tags.get("waterway") == "riverbank"
                    table, layer = ("water_areas" if water else "landcover"), "ground"
                else:
                    continue
                classification = catalog.classify(tags, "prop" if layer == "prop" else "ground")
                cursor.execute(
                    f"INSERT INTO {table} (id,region_id,geometry,tags,class) VALUES (%s,%s,ST_SetSRID(ST_GeomFromGeoJSON(%s),4326),%s,%s) "
                    "ON CONFLICT(id) DO UPDATE SET geometry=excluded.geometry,tags=excluded.tags,class=excluded.class",
                    (
                        feature.id,
                        region,
                        json.dumps(feature.geometry),
                        Jsonb(tags),
                        classification.key,
                    ),
                )
                counts[table] += 1
            cursor.execute("ANALYZE landcover")
            rows = list(cursor.execute(BUILDINGS, (region,)))
            updates = []
            for row in rows:
                tags = row[1] if isinstance(row[1], dict) else {}
                levels = int(str(row[4])) if row[4] is not None else None
                key, source = catalog.building(
                    tags,
                    bool(row[2]),
                    row[5] if isinstance(row[5], list) else [],
                    str(row[6]) if row[6] else None,
                    float(str(row[3])),
                    levels,
                )
                height = (
                    "height"
                    if length_values(tags.get("height"))
                    else "levels"
                    if levels
                    else "unknown"
                )
                updates.append((key, source, height, row[0]))
                counts[f"building_source:{source}"] += 1
            cursor.executemany(
                "UPDATE buildings SET class=%s,class_source=%s,height_source=%s WHERE id=%s",
                updates,
            )
            roads = list(
                cursor.execute("SELECT id,tags FROM walk_edges WHERE region_id=%s", (region,))
            )
            cursor.executemany(
                "UPDATE walk_edges SET class=%s WHERE id=%s",
                [
                    (catalog.classify(tags if isinstance(tags, dict) else {}, "ground").key, id)
                    for id, tags in roads
                ],
            )
            counts["buildings"] = len(updates)
            counts["roads"] = len(roads)
        return dict(counts)
