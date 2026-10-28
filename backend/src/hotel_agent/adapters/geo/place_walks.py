import math
from collections.abc import Mapping, Sequence

from pyproj import Transformer

from hotel_agent.adapters.geo.walk_attachment import attach_locations
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
    attached = attach_locations({"origin": origin, **targets}, coordinates, adjacency, project)
    start_xy = project.transform(*origin)
    start, connector = attached.get("origin", (None, math.inf))
    costs, parents = distances(adjacency, {start}, max_m * 3) if start else ({}, {})
    paths = []
    for place_id, target in targets.items():
        end_xy = project.transform(*target)
        end, link = attached.get(place_id, (None, math.inf))
        if start is None or end is None or end not in costs or link > 100:
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
