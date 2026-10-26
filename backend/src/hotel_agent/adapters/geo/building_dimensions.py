import re
from collections.abc import Mapping

from hotel_agent.application.visibility_records import BuildingDimensions
from hotel_agent.domain.visibility import ElevationRange

LENGTH = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(m|метр(?:а|ов)?|ft|feet|')?\s*$", re.IGNORECASE)


def length_values(value: str | None) -> tuple[float, ...]:
    if not value:
        return ()
    values = []
    for part in value.split(";"):
        match = LENGTH.fullmatch(part)
        if match is None:
            return ()
        number = float(match[1].replace(",", "."))
        if match[2] and match[2].lower() in {"ft", "feet", "'"}:
            number *= 0.3048
        if not 0 <= number <= 1500:
            return ()
        values.append(number)
    return tuple(values)


def building_dimensions(
    tags: Mapping[str, str],
    height_m: float | None = None,
    levels: int | None = None,
) -> BuildingDimensions:
    floors = length_values(tags.get("building:levels"))
    if floors and all(value.is_integer() and 1 <= value <= 200 for value in floors):
        levels = int(max(floors))
    minimum = length_values(tags.get("min_height"))
    minimum_m = min(minimum) if minimum else 0.0
    heights = length_values(tags.get("height"))
    if heights:
        return BuildingDimensions(
            ElevationRange(min(heights), max(heights)),
            levels,
            "osm:height",
            len(set(heights)) > 1,
            minimum_m,
        )
    if levels is not None and 1 <= levels <= 200:
        roof = length_values(tags.get("roof:height"))
        roof_min, roof_max = (min(roof), max(roof)) if roof else (0.0, 3.0)
        low_floors = min(floors) if floors else levels
        return BuildingDimensions(
            ElevationRange(low_floors * 2.7 + roof_min, levels * 4.5 + roof_max),
            levels,
            "osm:building:levels",
            True,
            minimum_m,
        )
    if height_m is not None and 0 < height_m <= 1500:
        return BuildingDimensions(
            ElevationRange(height_m, height_m), None, "database_height", True, minimum_m
        )
    return BuildingDimensions(None, levels, "unknown", True, minimum_m)
