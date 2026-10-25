import json
from collections.abc import Callable, Iterator, Mapping
from pathlib import Path
from typing import Any

import osmium

from hotel_agent.adapters.osm import tags as rules
from hotel_agent.application.dto import Feature, Geometry, SeedLayers
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.value_objects import BBox

COORD_DIGITS = 7


class PbfRegionSource:
    def __init__(self, path: Path, logger: LoggerPort) -> None:
        self._path = path
        self._logger = logger

    @property
    def description(self) -> str:
        return f"osm:{self._path.name}"

    def read(self, bbox: BBox) -> SeedLayers:
        return read_region(self._path, bbox, self._logger)


def read_region(path: Path, bbox: BBox, logger: LoggerPort) -> SeedLayers:
    layers = SeedLayers()
    geojson = osmium.geom.GeoJSONFactory()
    seen = 0
    processor = (
        osmium.FileProcessor(str(path))
        .with_locations("flex_mem")
        .with_areas()
        .with_filter(osmium.filter.EmptyTagFilter())
    )
    for obj in processor:
        seen += 1
        if seen % 10_000_000 == 0:
            logger.info("seed_scan", millions=seen // 1_000_000, kept=sum(layers.counts().values()))
        tags = dict(obj.tags)
        if not tags:
            continue
        if isinstance(obj, osmium.osm.Area):
            _area(obj, tags, geojson, bbox, layers)
        elif isinstance(obj, osmium.osm.Node):
            _node(obj, tags, bbox, layers)
        elif isinstance(obj, osmium.osm.Way):
            _way(obj, tags, geojson, bbox, layers)
    return layers


def iter_region_batches(
    path: Path,
    bbox: BBox,
    logger: LoggerPort,
    selected_layers: frozenset[str],
    batch_size: int = 5_000,
) -> Iterator[SeedLayers]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    layers = SeedLayers()
    geojson = osmium.geom.GeoJSONFactory()
    kept = 0
    seen = 0
    processor = osmium.FileProcessor(str(path)).with_locations("flex_mem")
    if selected_layers & {"hotels", "pois", "buildings", "beaches"}:
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
            _area(obj, tags, geojson, bbox, layers, selected_layers)
        elif isinstance(obj, osmium.osm.Node):
            _node(obj, tags, bbox, layers, selected_layers)
        elif isinstance(obj, osmium.osm.Way):
            _way(obj, tags, geojson, bbox, layers, selected_layers)
        size = sum(layers.counts().values())
        if size >= batch_size:
            kept += size
            yield layers
            layers = SeedLayers()
    if sum(layers.counts().values()):
        yield layers


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


def _node(
    obj: Any,
    tags: dict[str, str],
    bbox: BBox,
    layers: SeedLayers,
    selected_layers: frozenset[str] | None = None,
) -> None:
    if not obj.location.valid():
        return
    lon, lat = obj.location.lon, obj.location.lat
    if not _inside(bbox, lon, lat):
        return
    point: Geometry = {"type": "Point", "coordinates": [_round(lon), _round(lat)]}
    if (selected_layers is None or "hotels" in selected_layers) and rules.is_hotel(tags):
        layers.hotels.append(_feature(f"n{obj.id}", point, tags, rules.HOTEL_KEYS))
    if (selected_layers is None or "pois" in selected_layers) and rules.is_poi(tags):
        layers.pois.append(_feature(f"n{obj.id}", point, tags, rules.POI_KEYS))


def _way(
    obj: Any,
    tags: dict[str, str],
    geojson: Any,
    bbox: BBox,
    layers: SeedLayers,
    selected_layers: frozenset[str] | None = None,
) -> None:
    wanted = (
        ((selected_layers is None or "coastline" in selected_layers) and rules.is_coastline(tags))
        or (
            (selected_layers is None or "noise_sources" in selected_layers)
            and rules.is_noise_source(tags)
        )
        or ((selected_layers is None or "walk" in selected_layers) and rules.is_walkable(tags))
    )
    if not wanted:
        return
    line = _geometry(lambda: geojson.create_linestring(obj))
    if line is None or not _touches(bbox, line):
        return
    if (selected_layers is None or "coastline" in selected_layers) and rules.is_coastline(tags):
        layers.coastline.append(_feature(f"w{obj.id}", line, tags, ("natural", "name")))
    if (selected_layers is None or "noise_sources" in selected_layers) and rules.is_noise_source(
        tags
    ):
        layers.noise_sources.append(_feature(f"w{obj.id}", line, tags, rules.NOISE_KEYS))
    if (selected_layers is None or "walk" in selected_layers) and rules.is_walkable(tags):
        layers.walk.append(_feature(f"w{obj.id}", line, tags, rules.WALK_KEYS))


def _area(
    obj: Any,
    tags: dict[str, str],
    geojson: Any,
    bbox: BBox,
    layers: SeedLayers,
    selected_layers: frozenset[str] | None = None,
) -> None:
    hotel = (selected_layers is None or "hotels" in selected_layers) and rules.is_hotel(tags)
    building = (selected_layers is None or "buildings" in selected_layers) and rules.is_building(
        tags
    )
    beach = (selected_layers is None or "beaches" in selected_layers) and rules.is_beach(tags)
    poi = (selected_layers is None or "pois" in selected_layers) and rules.is_poi(tags)
    if not (hotel or building or beach or poi):
        return
    polygon = _geometry(lambda: geojson.create_multipolygon(obj))
    if polygon is None or not _touches(bbox, polygon):
        return
    identifier = f"{'r' if obj.from_way() is False else 'w'}{obj.orig_id()}"
    if building:
        layers.buildings.append(_feature(identifier, polygon, tags, rules.BUILDING_KEYS))
    if beach:
        layers.beaches.append(_feature(identifier, polygon, tags, ("natural", "leisure", "name")))
    centre = _centroid(polygon)
    if centre is None:
        return
    if hotel:
        layers.hotels.append(_feature(identifier, centre, tags, rules.HOTEL_KEYS))
    if poi:
        layers.pois.append(_feature(identifier, centre, tags, rules.POI_KEYS))


def _feature(
    identifier: str, geometry: Geometry, tags: Mapping[str, str], keys: tuple[str, ...]
) -> Feature:
    return Feature(id=identifier, geometry=geometry, properties=rules.selected(tags, keys))


def _geometry(build: Callable[[], str]) -> Geometry | None:
    try:
        raw = build()
    except (RuntimeError, osmium.InvalidLocationError):
        return None
    if not raw:
        return None
    geometry: Geometry = json.loads(raw)
    geometry["coordinates"] = _rounded(geometry["coordinates"])
    return geometry


def _rounded(coordinates: Any) -> Any:
    if isinstance(coordinates, list):
        if coordinates and isinstance(coordinates[0], float | int):
            return [_round(value) for value in coordinates]
        return [_rounded(item) for item in coordinates]
    return coordinates


def _round(value: float) -> float:
    return round(float(value), COORD_DIGITS)


def _points(coordinates: Any) -> Iterator[tuple[float, float]]:
    if isinstance(coordinates, list):
        if len(coordinates) == 2 and isinstance(coordinates[0], float | int):
            yield (float(coordinates[0]), float(coordinates[1]))
            return
        for item in coordinates:
            yield from _points(item)


def _touches(bbox: BBox, geometry: Geometry) -> bool:
    return any(_inside(bbox, lon, lat) for lon, lat in _points(geometry["coordinates"]))


def _centroid(geometry: Geometry) -> Geometry | None:
    points = list(_points(geometry["coordinates"]))
    if not points:
        return None
    lon = sum(point[0] for point in points) / len(points)
    lat = sum(point[1] for point in points) / len(points)
    return {"type": "Point", "coordinates": [_round(lon), _round(lat)]}


def _inside(bbox: BBox, lon: float, lat: float) -> bool:
    return bbox.min_lon <= lon <= bbox.max_lon and bbox.min_lat <= lat <= bbox.max_lat
