import math
from collections import defaultdict
from collections.abc import Mapping
from itertools import pairwise

from pyproj import Transformer
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

from hotel_agent.adapters.geo.walk_network import Adjacency, Node


def attach_locations(
    locations: Mapping[str, tuple[float, float]],
    coordinates: dict[Node, tuple[float, float]],
    adjacency: Adjacency,
    project: Transformer,
) -> dict[str, tuple[Node, float]]:
    edges = [(a, b) for a, neighbors in adjacency.items() for b in neighbors if a < b]
    if not edges:
        return {}
    segments = [LineString([coordinates[a], coordinates[b]]) for a, b in edges]
    tree = STRtree(segments)
    inverse = Transformer.from_crs(project.target_crs, project.source_crs, always_xy=True)
    splits: dict[int, list[tuple[float, Node]]] = defaultdict(list)
    attached = {}
    for id, location in locations.items():
        xy = project.transform(*location)
        point = Point(xy)
        index = int(tree.nearest(point))
        segment = segments[index]
        offset = segment.project(point)
        snap = segment.interpolate(offset)
        gap = point.distance(snap)
        if gap > 100:
            continue
        a, b = edges[index]
        if offset < 0.001:
            node = a
        elif segment.length - offset < 0.001:
            node = b
        else:
            lon, lat = inverse.transform(snap.x, snap.y)
            node = (round(lon, 7), round(lat, 7))
            coordinates[node] = project.transform(*node)
            splits[index].append((offset, node))
        attached[id] = (node, gap)
    for index, points in splits.items():
        a, b = edges[index]
        adjacency[a].pop(b, None)
        adjacency[b].pop(a, None)
        ordered = [a, *(node for _, node in sorted(points)), b]
        for first, second in pairwise(ordered):
            if first == second:
                continue
            length = math.dist(coordinates[first], coordinates[second])
            adjacency.setdefault(first, {})[second] = length
            adjacency.setdefault(second, {})[first] = length
    return attached
