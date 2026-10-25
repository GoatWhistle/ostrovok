from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass(frozen=True, slots=True)
class WeatherSnapshot:
    date: date
    hour: int
    temperature_c: float
    cloud_cover_pct: int
    weather_code: int


class WeatherPort(Protocol):
    async def fetch(
        self, lat: float, lon: float, date_value: date, hour: int
    ) -> WeatherSnapshot | None: ...
