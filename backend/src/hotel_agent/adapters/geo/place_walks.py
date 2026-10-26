import math
from collections.abc import Mapping, Sequence

from pyproj import Transformer
from shapely.geometry import Point
from shapely.strtree import STRtree

from hotel_agent.adapters.geo.walk_network import WALK_METERS_PER_MINUTE, build_graph, distances
from hotel_agent.application.dto import Feature
from hotel_agent.application.ports.walk import PlaceWalk


def calculate_walks(
    hotel_id: str,
    origin: tuple[float, float],
    targets: Mapping[str, tuple[float, float]],
    edges: Sequence[Feature],
    max_m: float,
) -> list[PlaceWalk]:
    project = Transformer.from_crs(4326, 32637, always_xy=True)
    coordinates, adjacency = build_graph(edges, project)
    nodes = list(coordinates)
    tree = STRtree([Point(coordinates[node]) for node in nodes])
    start_xy = project.transform(*origin)
    nearest = tree.nearest(Point(start_xy)) if nodes else None
    start = nodes[int(nearest)] if nearest is not None else None
    connector = math.dist(start_xy, coordinates[start]) if start is not None else math.inf
    costs, parents = (
        distances(adjacency, {start}, max_m * 3) if start and connector <= 100 else ({}, {})
    )
    paths = []
    for place_id, target in targets.items():
        end_xy = project.transform(*target)
        nearest = tree.nearest(Point(end_xy)) if nodes else None
        end = nodes[int(nearest)] if nearest is not None else None
        link = math.dist(end_xy, coordinates[end]) if end is not None else math.inf
        if start is None or end not in costs or link > 100:
            paths.append(
                PlaceWalk(
                    hotel_id=hotel_id,
                    place_id=place_id,
                    meters=round(math.dist(start_xy, end_xy), 1),
                    minutes=None,
                    mode="straight",
                    geometry={"type": "LineString", "coordinates": [origin, target]},
                )
            )
            continue
        route = [end]
        while route[-1] in parents:
            route.append(parents[route[-1]])
        meters = costs[end] + connector + link
        paths.append(
            PlaceWalk(
                hotel_id=hotel_id,
                place_id=place_id,
                meters=round(meters, 1),
                minutes=round(meters / WALK_METERS_PER_MINUTE, 1),
                mode="graph",
                geometry={"type": "LineString", "coordinates": [origin, *reversed(route), target]},
            )
        )
    return paths
