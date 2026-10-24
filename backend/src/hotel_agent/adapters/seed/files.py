import json
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

from hotel_agent.application.dto import Feature
from hotel_agent.domain.errors import InvalidValue

LAYER_SUFFIX = ".geojson"


def write_layer(directory: Path, name: str, features: Sequence[Feature]) -> int:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{name}{LAYER_SUFFIX}"
    with path.open("w", encoding="utf-8") as sink:
        sink.write('{"type":"FeatureCollection","features":[\n')
        for position, feature in enumerate(features):
            separator = ",\n" if position else ""
            sink.write(separator + json.dumps(_as_feature(feature), ensure_ascii=False))
        sink.write("\n]}\n")
    return path.stat().st_size


def read_layer(directory: Path, name: str) -> list[Feature]:
    path = directory / f"{name}{LAYER_SUFFIX}"
    if not path.is_file():
        raise InvalidValue(f"Seed layer {path} is missing")
    document = json.loads(path.read_text(encoding="utf-8"))
    return [_as_record(item) for item in document["features"]]


def write_meta(directory: Path, meta: dict[str, Any]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def read_meta(directory: Path) -> dict[str, Any]:
    path = directory / "meta.json"
    if not path.is_file():
        raise InvalidValue(f"Seed metadata {path} is missing")
    document: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return document


def total_size(directory: Path, names: Iterable[str]) -> int:
    return sum((directory / f"{name}{LAYER_SUFFIX}").stat().st_size for name in names)


def _as_feature(feature: Feature) -> dict[str, Any]:
    return {
        "type": "Feature",
        "id": feature.id,
        "geometry": feature.geometry,
        "properties": feature.properties,
    }


def _as_record(item: dict[str, Any]) -> Feature:
    return Feature(
        id=str(item["id"]), geometry=item["geometry"], properties=dict(item["properties"])
    )
