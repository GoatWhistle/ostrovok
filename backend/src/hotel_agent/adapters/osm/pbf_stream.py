from collections.abc import Callable, Iterator
from pathlib import Path

import osmium

from hotel_agent.adapters.osm import tags as rules
from hotel_agent.adapters.osm.closed_way_polygon import append_closed_way
from hotel_agent.adapters.osm.pbf_reader import _area, _node, _way
from hotel_agent.application.dto import SeedLayers
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.value_objects import BBox


def iter_region_batches(
    path: Path,
    bbox: BBox,
    logger: LoggerPort,
    selected_layers: frozenset[str],
    batch_size: int = 5_000,
    building_nearby: Callable[[float, float], bool] | None = None,
) -> Iterator[SeedLayers]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    layers = SeedLayers()
    geojson = osmium.geom.GeoJSONFactory()
    kept = 0
    seen = 0
    assemble_areas = bool(selected_layers & {"hotels", "pois", "beaches"}) or (
        "buildings" in selected_layers and building_nearby is None
    )
    node_locations = None
    if selected_layers == {"buildings"} and building_nearby:
        node_locations = _nearby_nodes(path, bbox, building_nearby, logger)
        processor = osmium.FileProcessor(str(path))
    else:
        processor = osmium.FileProcessor(str(path)).with_locations("flex_mem")
    if assemble_areas:
        processor = processor.with_areas()
    processor = processor.with_filter(osmium.filter.EmptyTagFilter())
    keys = _filter_keys(selected_layers)
    if keys:
        processor = processor.with_filter(osmium.filter.KeyFilter(*keys))
    for obj in processor:
        seen += 1
        if seen % 10_000_000 == 0:
            logger.info("country_scan", millions=seen // 1_000_000, kept=kept)
        tags = dict(obj.tags)
        if not tags:
            continue
        if isinstance(obj, osmium.osm.Area):
            _area(obj, tags, geojson, bbox, layers, selected_layers, building_nearby)
        elif isinstance(obj, osmium.osm.Node):
            _node(obj, tags, bbox, layers, selected_layers)
        elif isinstance(obj, osmium.osm.Way):
            _way(obj, tags, geojson, bbox, layers, selected_layers)
            if not assemble_areas:
                append_closed_way(
                    obj, tags, bbox, layers, selected_layers, building_nearby, node_locations
                )
        size = sum(layers.counts().values())
        if size >= batch_size:
            kept += size
            yield layers
            layers = SeedLayers()
    if sum(layers.counts().values()):
        yield layers


def _nearby_nodes(
    path: Path,
    bbox: BBox,
    building_nearby: Callable[[float, float], bool],
    logger: LoggerPort,
) -> dict[int, tuple[float, float]]:
    locations: dict[int, tuple[float, float]] = {}
    seen = 0
    for obj in osmium.FileProcessor(str(path)):
        if not isinstance(obj, osmium.osm.Node) or not obj.location.valid():
            continue
        seen += 1
        if seen % 10_000_000 == 0:
            logger.info("country_node_scan", millions=seen // 1_000_000, kept=len(locations))
        lon, lat = obj.location.lon, obj.location.lat
        if (
            bbox.min_lon <= lon <= bbox.max_lon
            and bbox.min_lat <= lat <= bbox.max_lat
            and building_nearby(lon, lat)
        ):
            locations[obj.id] = (lon, lat)
    logger.info("country_nearby_nodes", seen=seen, kept=len(locations))
    return locations


def _filter_keys(selected_layers: frozenset[str]) -> tuple[str, ...]:
    keys: set[str] = set()
    if "hotels" in selected_layers:
        keys.add("tourism")
    if "pois" in selected_layers:
        keys.update(key for key in rules.POI_KEYS if key not in {"name", "opening_hours"})
    if "buildings" in selected_layers:
        keys.add("building")
    if "beaches" in selected_layers:
        keys.update(("natural", "leisure"))
    if "coastline" in selected_layers:
        keys.add("natural")
    if "noise_sources" in selected_layers:
        keys.update(("highway", "railway"))
    if "walk" in selected_layers:
        keys.add("highway")
    return tuple(sorted(keys))
