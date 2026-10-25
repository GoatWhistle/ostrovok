from collections.abc import Callable
from typing import Any

from shapely.geometry import Polygon

from hotel_agent.adapters.osm import tags as rules
from hotel_agent.application.dto import Feature, Geometry, SeedLayers
from hotel_agent.domain.value_objects import BBox


def append_closed_way(
    obj: Any,
    tags: dict[str, str],
    bbox: BBox,
    layers: SeedLayers,
    selected_layers: frozenset[str],
    building_nearby: Callable[[float, float], bool] | None,
    node_locations: dict[int, tuple[float, float]] | None = None,
) -> None:
    building = "buildings" in selected_layers and rules.is_building(tags)
    beach = "beaches" in selected_layers and rules.is_beach(tags)
    if not (building or beach):
        return
    nodes = obj.nodes
    if len(nodes) < 4 or nodes[0].ref != nodes[-1].ref:
        return
    if node_locations is None:
        if any(not node.location.valid() for node in nodes):
            return
        ring = [(node.location.lon, node.location.lat) for node in nodes]
    else:
        if any(node.ref not in node_locations for node in nodes):
            return
        ring = [node_locations[node.ref] for node in nodes]
    if not any(
        bbox.min_lon <= lon <= bbox.max_lon and bbox.min_lat <= lat <= bbox.max_lat
        for lon, lat in ring
    ):
        return
    if building and building_nearby:
        centre_lon = sum(lon for lon, _ in ring[:-1]) / (len(ring) - 1)
        centre_lat = sum(lat for _, lat in ring[:-1]) / (len(ring) - 1)
        building = building_nearby(centre_lon, centre_lat)
    if not (building or beach):
        return
    polygon = Polygon(ring)
    if polygon.is_empty or not polygon.is_valid or polygon.area == 0:
        return
    rounded_ring = [[round(lon, 7), round(lat, 7)] for lon, lat in ring]
    geometry: Geometry = {"type": "MultiPolygon", "coordinates": [[rounded_ring]]}
    identifier = f"w{obj.id}"
    if building:
        layers.buildings.append(
            Feature(
                id=identifier,
                geometry=geometry,
                properties=rules.selected(tags, rules.BUILDING_KEYS),
            )
        )
    if beach:
        layers.beaches.append(
            Feature(
                id=identifier,
                geometry=geometry,
                properties=rules.selected(tags, ("natural", "leisure", "name")),
            )
        )
