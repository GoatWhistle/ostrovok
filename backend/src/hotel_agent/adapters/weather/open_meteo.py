from datetime import date

import httpx

from hotel_agent.application.ports.weather import WeatherSnapshot

URL = "https://api.open-meteo.com/v1/forecast"


class OpenMeteoWeather:
    async def fetch(
        self, lat: float, lon: float, date_value: date, hour: int
    ) -> WeatherSnapshot | None:
        params: dict[str, str | float] = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,cloud_cover,weather_code",
            "timezone": "Europe/Moscow",
            "start_date": date_value.isoformat(),
            "end_date": date_value.isoformat(),
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(URL, params=params)
                response.raise_for_status()
                hourly = response.json().get("hourly", {})
        except (httpx.HTTPError, ValueError, TypeError):
            return None
        target = f"{date_value.isoformat()}T{hour:02d}:00"
        times = hourly.get("time", [])
        if not isinstance(times, list) or target not in times:
            return None
        index = times.index(target)
        try:
            temperature = float(hourly["temperature_2m"][index])
            cloud = int(hourly["cloud_cover"][index])
            code = int(hourly["weather_code"][index])
        except (KeyError, IndexError, TypeError, ValueError):
            return None
        return WeatherSnapshot(
            date=date_value,
            hour=hour,
            temperature_c=temperature,
            cloud_cover_pct=cloud,
            weather_code=code,
        )
