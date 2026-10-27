from collections.abc import Iterator
from pathlib import Path
from typing import Any

import osmium

from hotel_agent.application.dto import Feature, Geometry, SeedLayers

PLACE_KINDS = frozenset(("city", "town", "village", "hamlet", "suburb", "borough"))
SETTLEMENT_KEYS = ("name", "name:ru", "name:en", "place", "population", "addr:region")


def iter_settlement_batches(path: Path, batch_size: int = 5_000) -> Iterator[SeedLayers]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    layers = SeedLayers()
    processor = osmium.FileProcessor(str(path), osmium.osm.NODE).with_filter(
        osmium.filter.KeyFilter("place")
    )
    for item in processor:
        feature = _settlement(item)
        if feature is None:
            continue
        layers.pois.append(feature)
        if len(layers.pois) >= batch_size:
            yield layers
            layers = SeedLayers()
    if layers.pois:
        yield layers


def _settlement(item: Any) -> Feature | None:
    tags = dict(item.tags)
    if tags.get("place") not in PLACE_KINDS or not tags.get("name"):
        return None
    if not item.location.valid():
        return None
    point: Geometry = {
        "type": "Point",
        "coordinates": [round(item.location.lon, 7), round(item.location.lat, 7)],
    }
    return Feature(
        id=f"n{item.id}",
        geometry=point,
        properties={key: tags[key] for key in SETTLEMENT_KEYS if tags.get(key)},
    )
