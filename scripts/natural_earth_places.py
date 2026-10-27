import argparse
import json
from pathlib import Path

COUNTRY_POINT = {"RUS": (96.0, 62.5)}
RUSSIA_CITY_ZOOM = 7.0
WORLD_CITY_ZOOM = 5.0


def point(lon: float, lat: float, properties: dict[str, object]) -> dict[str, object]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lon, 3), round(lat, 3)]},
        "properties": properties,
    }


def countries(path: Path) -> list[dict[str, object]]:
    features = []
    for item in json.loads(path.read_text(encoding="utf-8"))["features"]:
        p = item["properties"]
        lon, lat = COUNTRY_POINT.get(p["ADM0_A3"], (p["LABEL_X"], p["LABEL_Y"]))
        features.append(
            point(
                lon,
                lat,
                {
                    "kind": "country",
                    "ru": p.get("NAME_RU") or p["NAME"],
                    "en": p.get("NAME_EN") or p["NAME"],
                    "z": round(float(p["MIN_LABEL"]), 1),
                    "rank": int(p["LABELRANK"]),
                },
            )
        )
    return features


def cities(path: Path) -> list[dict[str, object]]:
    features = []
    for item in json.loads(path.read_text(encoding="utf-8"))["features"]:
        p = item["properties"]
        zoom = float(p["MIN_ZOOM"])
        if zoom > (RUSSIA_CITY_ZOOM if p["ADM0_A3"] == "RUS" else WORLD_CITY_ZOOM):
            continue
        lon, lat = item["geometry"]["coordinates"]
        features.append(
            point(
                lon,
                lat,
                {
                    "kind": "capital" if p["FEATURECLA"] == "Admin-0 capital" else "city",
                    "ru": p.get("NAME_RU") or p["NAME"],
                    "en": p.get("NAME_EN") or p["NAME"],
                    "z": round(zoom, 1),
                    "rank": int(p["SCALERANK"]),
                },
            )
        )
    return features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("raw", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    features = countries(args.raw / "ne_50m_admin_0_countries.geojson")
    features += cities(args.raw / "ne_10m_populated_places.geojson")
    collection = {"type": "FeatureCollection", "features": features}
    text = json.dumps(collection, ensure_ascii=False, separators=(",", ":"))
    args.output.write_text(text, encoding="utf-8", newline="\n")
    print(len(features), args.output.stat().st_size)


if __name__ == "__main__":
    main()
