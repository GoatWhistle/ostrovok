from collections.abc import Mapping
from typing import Protocol


class ElevationPort(Protocol):
    def sample_points(self, points: Mapping[str, tuple[float, float]]) -> dict[str, float]: ...
