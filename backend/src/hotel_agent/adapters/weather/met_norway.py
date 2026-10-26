import asyncio
import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from email.utils import parsedate_to_datetime
from math import isfinite
from time import monotonic
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from hotel_agent.application.ports.weather import WeatherSnapshot

URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
SOURCE = "https://www.met.no/en/free-meteorological-data"
LICENSE = "https://creativecommons.org/licenses/by/4.0/"


@dataclass(slots=True)
class CachedForecast:
    payload: dict[str, Any]
    expires: datetime
    modified: str | None


class MetNorwayConditions:
    source = SOURCE
    attribution = f"MET Norway, CC BY 4.0 ({LICENSE}); wind converted from m/s to km/h"

    def __init__(self, user_agent: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        if not user_agent.strip() or not any(
            token in user_agent for token in ("https://", "http://", "@")
        ):
            raise ValueError(
                "MET Norway requires an identifying User-Agent with a contact URL or email"
            )
        self._client = httpx.AsyncClient(
            timeout=8, headers={"User-Agent": user_agent}, transport=transport
        )
        self._cache: dict[tuple[float, float], CachedForecast] = {}
        self._lock = asyncio.Lock()
        self._retry_at = 0.0

    async def aclose(self) -> None:
        await self._client.aclose()

    async def forecast(
        self, locations: Mapping[str, tuple[float, float]], at: datetime
    ) -> Mapping[str, Mapping[str, float]]:
        if at.utcoffset() is None:
            raise ValueError("Weather requires an explicit UTC offset")
        result = {}
        for key, location in list(locations.items())[:12]:
            row = self._row(await self._load(location), at)
            if row is None:
                continue
            details = row.get("data", {}).get("instant", {}).get("details", {})
            fields = {
                "temperature_c": ("air_temperature", 1),
                "cloud_cover_pct": ("cloud_area_fraction", 1),
                "wind_speed_kmh": ("wind_speed", 3.6),
            }
            result[key] = {
                name: round(float(details[field]) * factor, 2)
                for name, (field, factor) in fields.items()
                if isinstance(details.get(field), int | float) and isfinite(float(details[field]))
            }
        return result

    async def fetch(
        self, lat: float, lon: float, date_value: date, hour: int
    ) -> WeatherSnapshot | None:
        at = datetime.combine(
            date_value, datetime.min.time(), tzinfo=ZoneInfo("Europe/Moscow")
        ).replace(hour=hour)
        try:
            row = self._row(await self._load((lon, lat)), at)
        except (ValueError, TypeError):
            return None
        if row is None:
            return None
        details = row.get("data", {}).get("instant", {}).get("details", {})
        temp, cloud = details.get("air_temperature"), details.get("cloud_area_fraction")
        symbol = (
            row.get("data", {}).get("next_1_hours", {}).get("summary", {}).get("symbol_code", "")
        )
        codes = {
            "clearsky": 0,
            "fair": 1,
            "partlycloudy": 2,
            "cloudy": 3,
            "fog": 45,
            "lightrain": 61,
            "rain": 63,
            "heavyrain": 65,
            "lightsnow": 71,
            "snow": 73,
            "heavysnow": 75,
            "lightrainshowers": 80,
            "rainshowers": 81,
            "heavyrainshowers": 82,
        }
        code = 95 if "thunder" in str(symbol) else codes.get(str(symbol).split("_")[0])
        if not isinstance(symbol, str):
            return None
        if not isinstance(temp, int | float) or not isinstance(cloud, int | float) or code is None:
            return None
        return WeatherSnapshot(
            date_value, hour, float(temp), round(cloud), code, f"MET Norway, CC BY 4.0 ({LICENSE})"
        )

    def _row(self, payload: dict[str, Any], at: datetime) -> dict[str, Any] | None:
        target = at.astimezone(UTC)
        properties = payload.get("properties")
        if not isinstance(properties, dict) or not isinstance(properties.get("timeseries"), list):
            raise TypeError("MET Norway returned an invalid timeseries")
        rows = properties["timeseries"]
        for row in rows:
            if not isinstance(row, dict):
                continue
            try:
                when = datetime.fromisoformat(row["time"])
            except (ValueError, KeyError, TypeError):
                continue
            if when.utcoffset() is not None and abs((when - target).total_seconds()) <= 1800:
                return row
        return None

    async def _load(self, location: tuple[float, float]) -> dict[str, Any]:
        if (
            not all(isfinite(v) for v in location)
            or not -180 <= location[0] <= 180
            or not -90 <= location[1] <= 90
        ):
            raise ValueError("Invalid weather coordinates")
        point = (round(location[0], 4), round(location[1], 4))
        async with self._lock:
            cached = self._cache.get(point)
            now = datetime.now(UTC)
            if cached and cached.expires > now:
                return cached.payload
            if monotonic() < self._retry_at:
                raise ValueError("MET Norway rate limit: retry later")
            headers = {"If-Modified-Since": cached.modified} if cached and cached.modified else {}
            try:
                async with asyncio.timeout(10):
                    async with self._client.stream(
                        "GET",
                        URL,
                        params={"lon": str(point[0]), "lat": str(point[1])},
                        headers=headers,
                    ) as response:
                        if response.status_code == 429:
                            retry = response.headers.get("Retry-After", "60")
                            try:
                                delay = max(60.0, float(retry))
                            except ValueError:
                                try:
                                    delay = max(
                                        60.0, (parsedate_to_datetime(retry) - now).total_seconds()
                                    )
                                except (ValueError, TypeError):
                                    delay = 60.0
                            self._retry_at = monotonic() + delay
                        if response.status_code == 304 and cached:
                            payload = cached.payload
                        else:
                            response.raise_for_status()
                            body = bytearray()
                            async for chunk in response.aiter_bytes():
                                body.extend(chunk)
                                if len(body) > 2_000_000:
                                    raise ValueError("MET Norway response exceeds 2 MB")
                            payload = json.loads(body)
                            if not isinstance(payload, dict):
                                raise ValueError("MET Norway returned an invalid forecast")
                        try:
                            expires = parsedate_to_datetime(response.headers["Expires"])
                            if expires.utcoffset() is None:
                                raise ValueError("Timezone missing")
                        except (KeyError, ValueError, TypeError):
                            expires = now + timedelta(minutes=10)
                        self._cache[point] = CachedForecast(
                            payload,
                            expires,
                            response.headers.get("Last-Modified")
                            or (cached.modified if cached else None),
                        )
                        if len(self._cache) > 128:
                            del self._cache[next(iter(self._cache))]
                        return payload
            except (httpx.HTTPError, TimeoutError, json.JSONDecodeError) as error:
                raise ValueError("MET Norway forecast is unavailable") from error
