from collections.abc import Mapping
from typing import Protocol


class ViewAssessmentPort(Protocol):
    async def assess(
        self,
        locations: Mapping[str, tuple[float, float]],
        direction_deg: float,
        observer_height_m: float,
        radius_m: float,
    ) -> Mapping[str, Mapping[str, float]]: ...
