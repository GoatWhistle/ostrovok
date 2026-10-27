from datetime import UTC, date, datetime, timedelta
from math import ceil

from hotel_agent.application.agent.solar_position import solar_position

FLOOR_HEIGHT_M = 3.0
SEASON = (4, 8)
FACADE_TOLERANCE_DEG = 45.0
COARSE = timedelta(minutes=10)


def sunset_azimuth(day: date, longitude: float, latitude: float) -> float | None:
    start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    before, previous = start, solar_position(start, longitude, latitude)
    for index in range(1, 145):
        at = start + COARSE * index
        current = solar_position(at, longitude, latitude)
        if previous["sun_altitude_deg"] > 0 >= current["sun_altitude_deg"]:
            return _crossing(before, at, longitude, latitude)
        before, previous = at, current
    return None


def _crossing(before: datetime, after: datetime, longitude: float, latitude: float) -> float:
    for _ in range(8):
        middle = before + (after - before) / 2
        if solar_position(middle, longitude, latitude)["sun_altitude_deg"] > 0:
            before = middle
        else:
            after = middle
    return solar_position(before, longitude, latitude)["sun_azimuth_deg"]


def sunset_arc(
    longitude: float, latitude: float, year: int, season: tuple[int, int] = SEASON
) -> tuple[float, float] | None:
    azimuths = [
        value
        for month in range(season[0], season[1] + 1)
        if (value := sunset_azimuth(date(year, month, 15), longitude, latitude)) is not None
    ]
    if not azimuths:
        return None
    return (min(azimuths), max(azimuths))


def separation(first: float, second: float) -> float:
    return min((first - second) % 360, (second - first) % 360)


def faces_arc(
    azimuth_deg: float, arc: tuple[float, float], tolerance: float = FACADE_TOLERANCE_DEG
) -> bool:
    low, high = arc
    return any(separation(azimuth_deg, value) <= tolerance for value in (low, high, _middle(arc)))


def _middle(arc: tuple[float, float]) -> float:
    low, high = arc
    return (low + (high - low) % 360 / 2) % 360


def arc_middle(arc: tuple[float, float]) -> float:
    return _middle(arc)


def minimum_floor(
    ground_elevation_m: float, skyline_elevation_m: float, floor_height_m: float = FLOOR_HEIGHT_M
) -> int:
    clearance = skyline_elevation_m - ground_elevation_m
    if clearance <= 0:
        return 1
    return ceil(clearance / floor_height_m) + 1
