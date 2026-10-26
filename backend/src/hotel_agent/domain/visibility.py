from dataclasses import dataclass
from math import isfinite

EARTH_RADIUS_M = 6_371_008.8
VISIBLE_LIGHT_CURVATURE = 6 / 7


@dataclass(frozen=True, slots=True)
class ElevationRange:
    minimum_m: float
    maximum_m: float | None

    def __post_init__(self) -> None:
        if not isfinite(self.minimum_m) or (
            self.maximum_m is not None
            and (not isfinite(self.maximum_m) or self.maximum_m < self.minimum_m)
        ):
            raise ValueError("Invalid elevation interval")


@dataclass(frozen=True, slots=True)
class RayObstacle:
    id: str
    kind: str
    distance_m: float
    elevation: ElevationRange | None
    bottom: ElevationRange | None = None


@dataclass(frozen=True, slots=True)
class SightlineBlocker:
    id: str
    kind: str
    distance_m: float
    penetration_m: float
    confirmed: bool


@dataclass(frozen=True, slots=True)
class SightlineResult:
    status: str
    required_observer_elevation_m: float | None
    minimum_clearance_m: float | None
    unknown_obstacles: int
    blockers: tuple[SightlineBlocker, ...]
    complete_coverage: bool


def sightline(
    distance_m: float,
    observer: ElevationRange,
    target: ElevationRange,
    obstacles: tuple[RayObstacle, ...],
    *,
    complete_coverage: bool,
    curvature_coefficient: float = VISIBLE_LIGHT_CURVATURE,
    clearance_m: float = 0.2,
) -> SightlineResult:
    if not isfinite(distance_m) or distance_m <= 0 or not 0 <= curvature_coefficient <= 1:
        raise ValueError("Sightline requires a positive distance and curvature coefficient 0–1")
    if not isfinite(clearance_m) or clearance_m < 0:
        raise ValueError("Clearance must be nonnegative")
    required, margin, unknown = float("-inf"), float("inf"), 0
    blockers = []
    for obstacle in obstacles:
        d = obstacle.distance_m
        if not isfinite(d) or not 0 <= d <= distance_m:
            raise ValueError("Obstacle must lie on the observer-target segment")
        if d == 0 or d == distance_m:
            continue
        if obstacle.elevation is None:
            unknown += 1
            continue
        ratio = d / distance_m
        bulge = curvature_coefficient * d * (distance_m - d) / (2 * EARTH_RADIUS_M)
        lowest_line = observer.minimum_m * (1 - ratio) + target.minimum_m * ratio
        highest_line = (
            observer.maximum_m * (1 - ratio) + target.maximum_m * ratio
            if observer.maximum_m is not None and target.maximum_m is not None
            else None
        )
        if (
            obstacle.bottom is not None
            and highest_line is not None
            and obstacle.bottom.minimum_m + bulge - highest_line >= clearance_m
        ):
            margin = min(margin, obstacle.bottom.minimum_m + bulge - highest_line)
            continue
        maximum = obstacle.elevation.maximum_m
        if maximum is None:
            unknown += 1
        else:
            clearance = lowest_line - maximum - bulge
            margin = min(margin, clearance)
            required = max(
                required, (maximum + bulge + clearance_m - target.minimum_m * ratio) / (1 - ratio)
            )
        confirmed = False
        if highest_line is not None:
            penetration = obstacle.elevation.minimum_m + bulge - highest_line
            above_bottom = obstacle.bottom is None or (
                obstacle.bottom.maximum_m is not None
                and lowest_line > obstacle.bottom.maximum_m + bulge + clearance_m
            )
            confirmed = penetration > clearance_m and above_bottom
        else:
            penetration = 0.0
        possible_penetration = maximum + bulge - lowest_line if maximum is not None else 0.0
        if confirmed or possible_penetration > clearance_m:
            blockers.append(
                SightlineBlocker(
                    obstacle.id,
                    obstacle.kind,
                    d,
                    penetration if confirmed else possible_penetration,
                    confirmed,
                )
            )
    if any(blocker.confirmed for blocker in blockers):
        status = "blocked"
    elif complete_coverage and unknown == 0 and margin >= clearance_m:
        status = "visible"
    else:
        status = "unknown"
    return SightlineResult(
        status,
        required if complete_coverage and unknown == 0 and isfinite(required) else None,
        margin if isfinite(margin) else None,
        unknown,
        tuple(sorted(blockers, key=lambda item: (-int(item.confirmed), -item.penetration_m))),
        complete_coverage,
    )
