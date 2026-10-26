import math
from collections.abc import Sequence
from pathlib import Path

import rasterio
from pyproj import Transformer
from shapely.geometry import Point, box, shape
from shapely.ops import transform
from shapely.strtree import STRtree

from hotel_agent.adapters.geo.walk_network import (
    WALK_METERS_PER_MINUTE,
    Node,
    build_graph,
    distances,
)
from hotel_agent.adapters.seed.files import read_layer
from hotel_agent.application.ports.walk import WalkPath


class SochiWalkGraph:
    def __init__(self) -> None:
        self._project = Transformer.from_crs(4326, 32637, always_xy=True)

    def calculate(self, directory: Path) -> Sequence[WalkPath]:
        walk = read_layer(directory, "walk")
        coordinates, adjacency = build_graph(walk, self._project)
        if not coordinates:
            return []
        sources = self._sea_nodes(directory, coordinates)
        distance, parent = distances(adjacency, sources)
        points = [Point(*xy) for xy in coordinates.values()]
        tree = STRtree(points)
        node_ids = list(coordinates)
        paths: list[WalkPath] = []
        with rasterio.open(directory / "dem.tif") as dem:
            for hotel in read_layer(directory, "hotels"):
                longitude, latitude = hotel.geometry["coordinates"]
                x, y = self._project.transform(longitude, latitude)
                nearest = tree.nearest(Point(x, y))
                if nearest is None:
                    continue
                start = node_ids[int(nearest)]
                connector = math.dist((x, y), coordinates[start])
                if connector > 100 or start not in distance:
                    continue
                nodes = [start]
                while nodes[-1] in parent:
                    nodes.append(parent[nodes[-1]])
                route = [[longitude, latitude], *([lon, lat] for lon, lat in nodes)]
                meters = distance[start] + connector
                elevations = list(dem.sample([route[0], route[-1]]))
                elevation_delta = float(elevations[0][0] - elevations[1][0])
                paths.append(
                    WalkPath(
                        hotel_id=hotel.id,
                        minutes=round(meters / WALK_METERS_PER_MINUTE, 1),
                        meters=round(meters, 1),
                        elevation_delta_m=round(elevation_delta, 1),
                        geometry={"type": "LineString", "coordinates": route},
                    )
                )
        return paths

    def _sea_nodes(
        self, directory: Path, coordinates: dict[Node, tuple[float, float]]
    ) -> set[Node]:
        features = [*read_layer(directory, "coastline"), *read_layer(directory, "beaches")]
        shapes = [transform(self._project.transform, shape(item.geometry)) for item in features]
        tree = STRtree(shapes)
        sources: set[Node] = set()
        for node, (x, y) in coordinates.items():
            point = Point(x, y)
            candidates = tree.query(box(x - 50, y - 50, x + 50, y + 50))
            if any(shapes[int(index)].distance(point) <= 50 for index in candidates):
                sources.add(node)
        return sources
