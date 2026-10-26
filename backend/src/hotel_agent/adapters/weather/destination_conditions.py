from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

FIELDS = {
    "temperature_c": "temperature_2m",
    "feels_like_c": "apparent_temperature",
    "cloud_cover_pct": "cloud_cover",
    "precipitation_probability_pct": "precipitation_probability",
    "wind_speed_kmh": "wind_speed_10m",
}


class OpenMeteoConditions:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._client = httpx.AsyncClient(timeout=8, transport=transport)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def forecast(
        self, locations: Mapping[str, tuple[float, float]], at: datetime
    ) -> Mapping[str, Mapping[str, float]]:
        at = at.astimezone(UTC)
        if (
            not datetime.now(UTC).date()
            <= at.date()
            <= datetime.now(UTC).date() + timedelta(days=15)
        ):
            raise ValueError("The requested date is outside the available 16-day forecast")
        selected = list(locations.items())[:12]
        if not selected:
            return {}
        params: dict[str, str] = {
            "latitude": ",".join(str(point[1]) for _, point in selected),
            "longitude": ",".join(str(point[0]) for _, point in selected),
            "hourly": ",".join(FIELDS.values()),
            "timezone": "GMT",
            "start_date": at.date().isoformat(),
            "end_date": at.date().isoformat(),
        }
        try:
            response = await self._client.get(
                "https://api.open-meteo.com/v1/forecast", params=params
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise ValueError("The weather provider is unavailable") from error
        payload: Any = response.json()
        records = payload if isinstance(payload, list) else [payload]
        target = at.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:00")
        result = {}
        for (hotel_id, _), record in zip(selected, records, strict=False):
            hourly = record.get("hourly", {})
            times = hourly.get("time", [])
            if target not in times:
                continue
            index = times.index(target)
            result[hotel_id] = {
                key: float(hourly[field][index])
                for key, field in FIELDS.items()
                if isinstance(hourly.get(field), list)
                and index < len(hourly[field])
                and isinstance(hourly[field][index], int | float)
            }
        return result
