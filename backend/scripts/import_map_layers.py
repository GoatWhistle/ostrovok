import argparse
import gzip
import json
import os
from pathlib import Path

import psycopg

from hotel_agent.adapters.geo.overpass_layers import SOCHI, map_features
from hotel_agent.adapters.geo.sea_polygon import sea_polygon
from hotel_agent.adapters.map_catalog.importer import PostgresMapImporter
from hotel_agent.adapters.map_catalog.loader import load_catalog
from hotel_agent.adapters.seed.files import read_layer
from hotel_agent.application.dto import Feature
from hotel_agent.application.use_cases.import_map_layers import ImportMapLayers


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepared", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    root = args.root
    raw = root / "data/raw/sochi-map-layers.json.gz"
    prepared = root / "data/seed/sochi-map"
    prepared.mkdir(parents=True, exist_ok=True)
    if args.prepared or not raw.exists():
        with gzip.open(prepared / "layers.geojson.gz") as source:
            layer = json.load(source)
        features = [
            Feature(id=item["id"], geometry=item["geometry"], properties=item["properties"])
            for item in layer["features"]
        ]
        manifest = json.loads((prepared / "manifest.json").read_text())
        checks = manifest["sea"]
        timestamp = manifest["osm_timestamp"]
    else:
        with gzip.open(raw) as source:
            payload = json.load(source)
        features = map_features(payload["elements"])
        seed = root / "data/seed/sochi"
        sea, checks = sea_polygon(read_layer(seed, "coastline"), SOCHI, seed / "dem.tif")
        features.append(sea)
        timestamp = payload.get("osm3s", {}).get("timestamp_osm_base")
        layer = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": item.id,
                    "geometry": item.geometry,
                    "properties": item.properties,
                }
                for item in features
            ],
        }
        (prepared / "layers.geojson.gz").write_bytes(
            gzip.compress(json.dumps(layer).encode(), mtime=0)
        )
    with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
        result = ImportMapLayers(
            PostgresMapImporter(connection), load_catalog(root / "map-catalog")
        )("sochi", features)
    report = {
        "counts": result,
        "sea": checks,
        "osm_timestamp": timestamp,
    }
    (prepared / "manifest.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == "__main__":
    main()
