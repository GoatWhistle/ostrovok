import asyncio
import json
import re
from dataclasses import replace
from datetime import date
from typing import Any
from uuid import uuid4

import httpx

from hotel_agent.adapters.external.ostrovok_rates import site_offers
from hotel_agent.adapters.external.ostrovok_rooms import page_hotel, room_groups
from hotel_agent.application.ports.hotel_offers import OfferLookup, OfferProviderFailure


class OstrovokDetails:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def enrich(
        self, row: dict[str, Any], base: OfferLookup, check_in: date, check_out: date, adults: int
    ) -> OfferLookup:
        slug = row.get("ota_hotel_id")
        region = row["static_vm"].get("region_catalog_slug")
        master_id = row["master_id"]
        if not isinstance(slug, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", slug):
            return base
        results: list[object] = await asyncio.gather(
            self._rates(
                slug, master_id, row["static_vm"].get("region_id", 153), check_in, check_out, adults
            ),
            self._catalog(slug, master_id, region),
            return_exceptions=True,
        )
        rates, catalog = results
        if isinstance(rates, dict):
            try:
                base = replace(base, offers=site_offers(rates, all_rates=True), rates_complete=True)
            except OfferProviderFailure:
                pass
        if isinstance(catalog, dict):
            try:
                base = replace(base, room_groups=room_groups(catalog))
            except (KeyError, TypeError, ValueError):
                pass
        return base

    async def _rates(
        self, slug: str, master_id: int, region: int, check_in: date, check_out: date, adults: int
    ) -> dict[str, Any]:
        body = {
            "hotel": slug,
            "arrival_date": str(check_in),
            "departure_date": str(check_out),
            "currency": "RUB",
            "lang": "ru",
            "region_id": region,
            "paxes": [{"adults": adults}],
            "search_uuid": str(uuid4()),
            "guru_auth_prices_enabled": False,
        }
        response = await self._client.get(
            "https://ostrovok.ru/hotel/search/v1/site/hp/search",
            params={"body": json.dumps(body)},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise TypeError("Invalid rate response")
        if data.get("ota_hotel_id") != slug or data.get("master_id") != master_id:
            raise ValueError("Rate hotel identity mismatch")
        if not isinstance(data.get("rates"), list) or any(
            r.get("hotel_id") != slug for r in data["rates"]
        ):
            raise ValueError("Invalid hotel rates")
        return data

    async def _catalog(self, slug: str, master_id: int, region: object) -> dict[str, Any]:
        if not isinstance(region, str) or not re.fullmatch(r"[a-z0-9_][a-z0-9_.-]*/[a-z0-9_][a-z0-9_.-]*", region):
            raise ValueError("Invalid hotel region")
        response = await self._client.get(
            f"https://ostrovok.ru/hotel/{region}/mid{master_id}/{slug}/",
            headers={"Accept": "text/html", "User-Agent": "Mozilla/5.0"},
            timeout=20,
        )
        response.raise_for_status()
        return page_hotel(response.text, slug, master_id)
