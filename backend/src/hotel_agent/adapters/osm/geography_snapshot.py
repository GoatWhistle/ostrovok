import json
from datetime import UTC, datetime
from xml.etree import ElementTree

import osmium
from shapely.geometry import box, shape

from hotel_agent.adapters.osm import tags as rules
from hotel_agent.application.dto import Feature, SeedLayers
from hotel_agent.application.ports.geography import GeographicBounds, GeographySnapshot


def parse_snapshot(payload: bytes, bbox: GeographicBounds, source_url: str) -> GeographySnapshot:
    root = ElementTree.fromstring(payload)
    if root.tag != "osm" or root.find("remark") is not None:
        raise ValueError("The geography response is not a complete OSM document")
    layers = SeedLayers()
    factory = osmium.geom.GeoJSONFactory()
    boundary = box(*bbox)
    expected, assembled = set(), set()
    expected_lines, assembled_lines = set(), set()
    for item in (
        osmium.FileProcessor(osmium.io.FileBuffer(payload, "osm"))
        .with_locations("flex_mem")
        .with_areas()
    ):
        tags = dict(item.tags)
        if not tags:
            continue
        if isinstance(item, osmium.osm.Area):
            identifier = f"{'w' if item.from_way() else 'r'}{item.orig_id()}"
            geometry = json.loads(factory.create_multipolygon(item))
            polygon = shape(geometry)
            if not polygon.is_valid or not polygon.intersects(boundary):
                continue
            assembled.add(identifier)
            feature = Feature(id=identifier, geometry=geometry, properties=tags)
            if rules.is_building(tags):
                layers.buildings.append(feature)
            if rules.is_beach(tags):
                layers.beaches.append(feature)
            centre = polygon.representative_point()
            point = Feature(
                id=identifier,
                geometry={"type": "Point", "coordinates": [centre.x, centre.y]},
                properties=tags,
            )
            if rules.is_hotel(tags):
                layers.hotels.append(point)
            if rules.is_poi(tags):
                layers.pois.append(point)
        elif isinstance(item, osmium.osm.Node) and item.location.valid():
            if not boundary.covers(shape({"type": "Point", "coordinates": [item.lon, item.lat]})):
                continue
            feature = Feature(
                id=f"n{item.id}",
                geometry={"type": "Point", "coordinates": [item.lon, item.lat]},
                properties=tags,
            )
            if rules.is_hotel(tags):
                layers.hotels.append(feature)
            if rules.is_poi(tags):
                layers.pois.append(feature)
        elif isinstance(item, osmium.osm.Way):
            if rules.is_building(tags) or rules.is_beach(tags):
                expected.add(f"w{item.id}")
            if rules.is_coastline(tags) or rules.is_noise_source(tags) or rules.is_walkable(tags):
                expected_lines.add(f"w{item.id}")
            try:
                geometry = json.loads(factory.create_linestring(item))
            except (RuntimeError, osmium.InvalidLocationError):
                continue
            feature = Feature(id=f"w{item.id}", geometry=geometry, properties=tags)
            assembled_lines.add(feature.id)
            if rules.is_coastline(tags):
                layers.coastline.append(feature)
            if rules.is_noise_source(tags):
                layers.noise_sources.append(feature)
            if rules.is_walkable(tags):
                layers.walk.append(feature)
        elif isinstance(item, osmium.osm.Relation) and (
            rules.is_building(tags) or rules.is_beach(tags)
        ):
            expected.add(f"r{item.id}")
    return GeographySnapshot(
        bbox,
        layers,
        source_url,
        datetime.now(UTC),
        expected <= assembled and expected_lines <= assembled_lines,
    )
