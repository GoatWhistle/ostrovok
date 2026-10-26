import heapq
import math
from collections.abc import Sequence
from itertools import pairwise

from pyproj import Transformer

from hotel_agent.application.dto import Feature

type Node = tuple[float, float]
type Adjacency = dict[Node, dict[Node, float]]
WALK_METERS_PER_MINUTE = 80


def build_graph(
    features: Sequence[Feature], project: Transformer
) -> tuple[dict[Node, tuple[float, float]], dict[Node, dict[Node, float]]]:
    coordinates: dict[Node, tuple[float, float]] = {}
    adjacency: dict[Node, dict[Node, float]] = {}
    for feature in features:
        line = feature.geometry["coordinates"]
        for first, second in pairwise(line):
            a = (round(first[0], 7), round(first[1], 7))
            b = (round(second[0], 7), round(second[1], 7))
            if a == b:
                continue
            coordinates.setdefault(a, project.transform(*a))
            coordinates.setdefault(b, project.transform(*b))
            length = math.dist(coordinates[a], coordinates[b])
            adjacency.setdefault(a, {})[b] = length
            adjacency.setdefault(b, {})[a] = length
    return coordinates, adjacency


def distances(
    adjacency: Adjacency, sources: set[Node], max_m: float = math.inf
) -> tuple[dict[Node, float], dict[Node, Node]]:
    distance = dict.fromkeys(sources, 0.0)
    parent: dict[Node, Node] = {}
    queue = [(0.0, source) for source in sources]
    heapq.heapify(queue)
    while queue:
        cost, node = heapq.heappop(queue)
        if cost > distance[node] or cost > max_m:
            continue
        for neighbor, length in adjacency[node].items():
            candidate = cost + length
            if candidate <= max_m and candidate < distance.get(neighbor, math.inf):
                distance[neighbor] = candidate
                parent[neighbor] = node
                heapq.heappush(queue, (candidate, neighbor))
    return distance, parent
