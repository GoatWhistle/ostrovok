from dataclasses import dataclass

from hotel_agent.domain.visibility import ElevationRange


@dataclass(frozen=True, slots=True)
class BuildingDimensions:
    height: ElevationRange | None
    levels: int | None
    height_source: str
    estimated: bool
    minimum_height_m: float = 0


@dataclass(frozen=True, slots=True)
class FacadeObserver:
    id: str
    location: tuple[float, float]
    azimuth_deg: float
    facade_width_m: float
