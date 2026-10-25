from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from hotel_agent.application.use_cases.get_weather import GetWeather


class WeatherSchema(BaseModel):
    status: Literal["available", "unavailable"]
    reason: str | None = None
    date: date
    hour: int
    temperature_c: float | None = None
    cloud_cover_pct: int | None = None
    weather_code: int | None = None
    source: str | None = None


def build_router(get_weather: GetWeather) -> APIRouter:
    router = APIRouter(tags=["weather"])

    @router.get("/weather", response_model=WeatherSchema, response_model_exclude_none=True)
    async def weather(
        date_value: Annotated[date, Query(alias="date")],
        lat: float = Query(ge=-90, le=90),
        lon: float = Query(ge=-180, le=180),
        hour: int = Query(default=18, ge=0, le=23),
    ) -> WeatherSchema:
        snapshot, reason = await get_weather(lat, lon, date_value, hour)
        if snapshot is None:
            return WeatherSchema(status="unavailable", reason=reason, date=date_value, hour=hour)
        return WeatherSchema(
            status="available",
            date=date_value,
            hour=hour,
            temperature_c=snapshot.temperature_c,
            cloud_cover_pct=snapshot.cloud_cover_pct,
            weather_code=snapshot.weather_code,
            source="Open-Meteo forecast",
        )

    return router
