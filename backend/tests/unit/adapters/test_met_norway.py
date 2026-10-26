from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

import httpx
import pytest

from hotel_agent.adapters.weather.met_norway import MetNorwayConditions

AT = datetime(2026, 10, 27, 9, tzinfo=UTC)
UA = "HotelAgent/0.1 (https://github.com/GoatWhistle/o-hack)"
PAYLOAD = {
    "properties": {
        "timeseries": [
            {
                "time": AT.isoformat(),
                "data": {
                    "instant": {
                        "details": {
                            "air_temperature": 15.4,
                            "cloud_area_fraction": 20,
                            "wind_speed": 5,
                        }
                    },
                    "next_1_hours": {"summary": {"symbol_code": "partlycloudy_day"}},
                },
            }
        ]
    }
}


async def test_forecast_cache_units_fields_and_map_moscow_time() -> None:
    calls = []

    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.headers["User-Agent"] == UA
        return httpx.Response(
            200,
            json=PAYLOAD,
            headers={
                "Expires": format_datetime(datetime.now(UTC) + timedelta(hours=1)),
                "Last-Modified": format_datetime(datetime.now(UTC)),
            },
        )

    provider = MetNorwayConditions(UA, httpx.MockTransport(respond))
    try:
        values = await provider.forecast({"h1": (39.720001, 43.580001)}, AT)
        assert values["h1"] == {"temperature_c": 15.4, "cloud_cover_pct": 20, "wind_speed_kmh": 18}
        snapshot = await provider.fetch(43.58, 39.72, AT.date(), 12)
        assert (
            snapshot is not None and snapshot.temperature_c == 15.4 and snapshot.weather_code == 2
        )
        assert len(calls) == 1
        assert not await provider.forecast({"h1": (39.72, 43.58)}, AT + timedelta(days=20))
        assert "MET Norway" in provider.attribution
    finally:
        await provider.aclose()


async def test_expired_cache_revalidates_with_modified_header_and_304() -> None:
    count = 0
    modified = "Mon, 26 Oct 2026 08:00:00 GMT"

    def respond(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        if count == 1:
            return httpx.Response(
                200,
                json=PAYLOAD,
                headers={"Expires": "Mon, 26 Oct 2020 09:00:00 GMT", "Last-Modified": modified},
            )
        assert request.headers["If-Modified-Since"] == modified
        return httpx.Response(
            304, headers={"Expires": format_datetime(datetime.now(UTC) + timedelta(hours=1))}
        )

    provider = MetNorwayConditions(UA, httpx.MockTransport(respond))
    try:
        assert await provider.forecast({"h": (39.72, 43.58)}, AT) == await provider.forecast(
            {"h": (39.72, 43.58)}, AT
        )
        assert count == 2
    finally:
        await provider.aclose()


async def test_rate_limit_is_not_retried_and_map_returns_unknown() -> None:
    calls = []

    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": "120"})

    provider = MetNorwayConditions(UA, httpx.MockTransport(respond))
    try:
        with pytest.raises(ValueError, match="unavailable"):
            await provider.forecast({"h": (39.72, 43.58)}, AT)
        assert await provider.fetch(43.58, 39.72, AT.date(), 12) is None
        assert len(calls) == 1
    finally:
        await provider.aclose()


def test_contact_is_required() -> None:
    with pytest.raises(ValueError, match="contact"):
        MetNorwayConditions("anonymous")
