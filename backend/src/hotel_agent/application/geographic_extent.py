def intersection(
    first: tuple[float, float, float, float], second: tuple[float, float, float, float]
) -> tuple[float, float, float, float] | None:
    west, south = max(first[0], second[0]), max(first[1], second[1])
    east, north = min(first[2], second[2]), min(first[3], second[3])
    return (west, south, east, north) if west <= east and south <= north else None
