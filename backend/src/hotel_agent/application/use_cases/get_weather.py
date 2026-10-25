from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from hotel_agent.application.ports.weather import WeatherPort, WeatherSnapshot


class GetWeather:
    def __init__(self, weather: WeatherPort) -> None:
        self._weather = weather

    async def __call__(
        self, lat: float, lon: float, date_value: date, hour: int
    ) -> tuple[WeatherSnapshot | None, str | None]:
        today = datetime.now(ZoneInfo("Europe/Moscow")).date()
        if date_value < today or date_value > today + timedelta(days=15):
            return None, "date_out_of_forecast"
        snapshot = await self._weather.fetch(lat, lon, date_value, hour)
        return snapshot, None if snapshot else "weather_unavailable"
