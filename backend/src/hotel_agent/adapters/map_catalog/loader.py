from pathlib import Path
from typing import cast

import yaml

from hotel_agent.application.map_catalog import MapCatalog, MapClass, MapLayer, TagRule
from hotel_agent.domain.errors import InvalidRegistry


def load_catalog(directory: Path) -> MapCatalog:
    classes = []
    for path in sorted(directory.glob("*.yaml")):
        value = yaml.safe_load(path.read_text())
        if not isinstance(value, dict) or value.get("key") != path.stem:
            raise InvalidRegistry(f"Invalid map class in {path.name}")
        if value.get("layer") not in {"ground", "volume", "prop", "poi"}:
            raise InvalidRegistry(f"Invalid map layer in {path.name}")
        style = value.get("style", {})
        if not isinstance(style, dict) or not str(style.get("fill", "")).startswith("--map-class-"):
            raise InvalidRegistry(f"Invalid map style in {path.name}")
        classes.append(
            MapClass(
                key=path.stem,
                layer=cast(MapLayer, value["layer"]),
                match=tuple(
                    TagRule(tag=str(rule["tag"]), values=tuple(str(v) for v in rule["values"]))
                    for rule in value.get("match", [])
                ),
                priority=int(value["priority"]),
                min_zoom=int(value["min_zoom"]),
                style={str(key): str(item) for key, item in style.items()},
                props=value.get("props"),
            )
        )
    for layer in ("ground", "volume", "prop", "poi"):
        if sum(item.layer == layer and not item.match for item in classes) != 1:
            raise InvalidRegistry(f"Map catalog requires one default for {layer}")
    return MapCatalog(classes)
