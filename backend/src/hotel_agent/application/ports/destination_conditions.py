from collections.abc import Mapping
from datetime import datetime
from typing import Protocol


class DestinationConditionsPort(Protocol):
    source: str
    attribution: str

    async def forecast(
        self, locations: Mapping[str, tuple[float, float]], at: datetime
    ) -> Mapping[str, Mapping[str, float]]: ...
