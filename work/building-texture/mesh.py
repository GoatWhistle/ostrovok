import math


def signed_area(points):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) / 2


def triangulate(points):
    remaining = list(range(len(points)))
    triangles = []

    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    while len(remaining) > 3:
        for i, b in enumerate(remaining):
            a, c = remaining[i - 1], remaining[(i + 1) % len(remaining)]
            if cross(points[a], points[b], points[c]) <= 1e-8:
                continue
            inside = any(
                min(cross(points[a], points[b], points[p]),
                    cross(points[b], points[c], points[p]),
                    cross(points[c], points[a], points[p])) >= -1e-8
                for p in remaining if p not in (a, b, c)
            )
            if not inside:
                triangles.extend((a, c, b))
                remaining.pop(i)
                break
        else:
            raise ValueError("Footprint cannot be triangulated")
    triangles.extend(reversed(remaining))
    return triangles


def building_mesh(feature, atlas):
    polygons = feature["geometry"]["coordinates"]
    if feature["geometry"]["type"] != "MultiPolygon" or len(polygons) != 1 or len(polygons[0]) != 1:
        raise ValueError("This asset builder accepts one polygon without holes")
    ring = polygons[0][0][:-1]
    lon = sum(p[0] for p in ring) / len(ring)
    lat = sum(p[1] for p in ring) / len(ring)
    scale = math.pi * 6378137 / 180
    points = [((x - lon) * scale * math.cos(math.radians(lat)), -(y - lat) * scale) for x, y in ring]
    if signed_area(points) < 0:
        points.reverse()
    edges = list(zip(points, points[1:] + points[:1]))
    a, b = max(edges, key=lambda edge: math.dist(*edge))
    length = math.dist(a, b)
    axis = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    across = (-axis[1], axis[0])
    along = [p[0] * axis[0] + p[1] * axis[1] for p in points]
    depth = [p[0] * across[0] + p[1] * across[1] for p in points]
    levels = int(feature["properties"]["building:levels"])
    height = levels * 3.0
    positions, normals, uvs, indices = [], [], [], []

    def uv(panel, u, v):
        left, top, right, bottom = atlas["panels_px"][panel]
        width, image_height = atlas["image_size_px"]
        return ((left + (right - left) * u) / width, (top + (bottom - top) * v) / image_height)

    for i, (a, b) in enumerate(edges):
        j = (i + 1) % len(points)
        dx, dz = b[0] - a[0], b[1] - a[1]
        distance = math.hypot(dx, dz)
        nx, nz = dz / distance, -dx / distance
        long_wall = abs((dx * axis[0] + dz * axis[1]) / distance) > 0.9
        if long_wall:
            panel = "front" if nx * across[0] + nz * across[1] > 0 else "rear"
            u0, u1 = [(along[k] - min(along)) / (max(along) - min(along)) for k in (i, j)]
        else:
            panel = "end"
            u0, u1 = [(depth[k] - min(depth)) / (max(depth) - min(depth)) for k in (i, j)]
        start = len(positions)
        positions.extend(((a[0], 0, a[1]), (a[0], height, a[1]), (b[0], height, b[1]), (b[0], 0, b[1])))
        normals.extend([(nx, 0, nz)] * 4)
        uvs.extend((uv(panel, u0, 1), uv(panel, u0, 0), uv(panel, u1, 0), uv(panel, u1, 1)))
        indices.extend(start + k for k in (0, 1, 2, 0, 2, 3))

    start = len(positions)
    for i, (x, z) in enumerate(points):
        positions.append((x, height, z))
        normals.append((0, 1, 0))
        uvs.append(uv("roof", (along[i] - min(along)) / (max(along) - min(along)),
                      (depth[i] - min(depth)) / (max(depth) - min(depth))))
    indices.extend(start + k for k in triangulate(points))
    start = len(positions)
    positions.extend((x, 0, z) for x, z in points)
    normals.extend([(0, -1, 0)] * len(points))
    uvs.extend([uv("roof", 0.01, 0.01)] * len(points))
    indices.extend(start + k for k in reversed(triangulate(points)))
    metadata = {
        "osm_id": feature["id"], "origin_wgs84": [lon, lat],
        "axes": {"x": "east", "y": "up", "z": "south"}, "units": "metres",
        "levels_osm": levels, "height_m": height, "height_method": "OSM levels multiplied by assumed 3 m",
        "height_measured": False, "footprint_area_m2": abs(signed_area(points)),
        "length_m": max(along) - min(along), "width_m": max(depth) - min(depth),
        "visual_reconstruction": True, "photogrammetry": False,
        "texture_floor_alignment_verified": False,
        "vertices": len(positions), "triangles": len(indices) // 3,
    }
    return positions, normals, uvs, indices, metadata
