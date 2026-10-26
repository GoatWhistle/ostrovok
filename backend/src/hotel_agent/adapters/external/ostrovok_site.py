import asyncio
import json
import math
import re
from datetime import date
from typing import Any
from uuid import uuid4

import httpx

from hotel_agent.application.ports.hotel_offers import OfferProviderFailure
from hotel_agent.domain.hotel_identity import HotelIdentity

SITE = "https://ostrovok.ru"
SERP = SITE + "/hotel/search/v2/site/serp"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
}
LODGING_WORDS = re.compile(
    r"\b(?:отель|гостиница|гостиничный|комплекс|гостевой|дом|хостел|hotel|resort|spa)\b",
    re.IGNORECASE,
)


class OstrovokSite:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(timeout=15, headers=HEADERS)
        self._owns_client = client is None

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def search(
        self, hotel: HotelIdentity, check_in: date, check_out: date, adults: int
    ) -> tuple[dict[str, Any], ...]:
        lon, lat = hotel.location
        lat_delta = 350 / 111_000
        lon_delta = lat_delta / max(0.01, math.cos(math.radians(lat)))
        params = {
            "arrival_date": str(check_in),
            "departure_date": str(check_out),
            "currency": "RUB",
            "language": "ru",
            "region_id": 153,
            "search_uuid": str(uuid4()),
            "paxes": [{"adults": adults}],
            "upper_left_corner": {"lat": lat + lat_delta, "lng": lon - lon_delta},
            "down_right_corner": {"lat": lat - lat_delta, "lng": lon + lon_delta},
        }
        label = " ".join(LODGING_WORDS.sub(" ", hotel.name).split()).strip(' «»"')
        filters = {"hotel_name": label} if label else {}
        try:
            opened = await self._json(
                "GET", params={"body": json.dumps({"session_params": params})}
            )
            session = opened["session_info"]["session"]["id"]
            if not isinstance(session, str) or not session:
                raise ValueError("Missing search session")
            rows: dict[int, dict[str, Any]] = {}
            for page in range(1, 4):
                for attempt in range(4):
                    body = await self._json(
                        "POST",
                        params={"session": session},
                        json={"session_params": params, "page": page, "filters": filters},
                    )
                    if body.get("search_finished") is True:
                        break
                    if attempt < 3:
                        await asyncio.sleep(1)
                else:
                    raise ValueError("Search did not finish")
                hotels, total = body.get("hotels"), body.get("total_av_hotels")
                if hotels is None and total == 0:
                    hotels = []
                if (
                    not isinstance(hotels, list)
                    or isinstance(total, bool)
                    or not isinstance(total, int)
                    or total < 0
                ):
                    raise ValueError("Invalid search page")
                before = len(rows)
                for row in hotels:
                    if not isinstance(row, dict):
                        raise TypeError("Invalid hotel")
                    hid = row.get("master_id")
                    if isinstance(hid, bool) or not isinstance(hid, int) or hid <= 0:
                        raise ValueError("Invalid hotel ID")
                    if hid in rows and rows[hid].get("static_vm") != row.get("static_vm"):
                        raise ValueError("Inconsistent hotel identity")
                    rows[hid] = row
                if len(rows) == total:
                    return tuple(rows.values())
                if len(rows) > total or len(rows) == before:
                    break
            raise ValueError("Incomplete hotel search")
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise OfferProviderFailure("Ostrovok website search failed") from error

    async def _json(
        self, method: str, *, params: dict[str, str], json: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        response = await self._client.request(
            method, SERP, params=params, json=json, headers=HEADERS
        )
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict) or body.get("error"):
            raise ValueError("Invalid website response")
        return body
