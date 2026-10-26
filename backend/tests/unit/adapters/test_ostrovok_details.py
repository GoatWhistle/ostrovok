import json
from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest

from hotel_agent.adapters.external.ostrovok_details import OstrovokDetails
from hotel_agent.application.ports.hotel_offers import OfferLookup


def row() -> dict[str, Any]:
    return {
        "ota_hotel_id": "test_hotel",
        "master_id": 17,
        "static_vm": {"region_catalog_slug": "russia/st._petersburg", "region_id": 5580},
    }


def rate(identifier: str, amount: str) -> dict[str, Any]:
    return {
        "hash": identifier,
        "hotel_id": "test_hotel",
        "room_name": "Стандарт",
        "rooms": [{"rg_hash": "group-1", "amenities_data": []}],
        "payment_options": {
            "payment_types": [{"show_amount": amount, "show_currency_code": "RUB"}]
        },
        "cancellation_info": {"free_cancellation_before": "2026-11-01T12:00:00Z"},
    }


def catalog() -> dict[str, Any]:
    return {
        "id": "test_hotel",
        "masterId": "17",
        "roomGroups": [
            {
                "rgHash": "group-1",
                "nameStruct": {"mainName": "Стандарт", "beddingType": "2 кровати"},
                "size": 17,
                "roomAmenityData": ["shower"],
                "images": [
                    {"tmpl": "https://cdn.ostrovok.ru/t/{size}/room-1.jpg"},
                    {"tmpl": "https://cdn.ostrovok.ru/t/{size}/room-2.jpg"},
                    {"tmpl": "https://untrusted.example/another-hotel.jpg"},
                ],
            },
            {"rgHash": "group-2", "nameStruct": {"mainName": "Люкс"}, "images": [], "size": 0},
        ],
    }


@pytest.mark.parametrize("failure", [None, "rates", "catalog", "identity", "room_identity"])
async def test_enrichment_keeps_rate_variants_and_scopes_room_photos(failure: str | None) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/hp/search"):
            params = json.loads(request.url.params["body"])
            assert params["paxes"] == [{"adults": 2}]
            assert params["arrival_date"] == "2026-11-02"
            assert params["departure_date"] == "2026-11-04"
            if failure == "rates":
                return httpx.Response(503)
            rates = [rate("a", "12000"), rate("b", "14000")]
            if failure == "room_identity":
                rates[1]["hotel_id"] = "another_hotel"
            return httpx.Response(
                200, json={"ota_hotel_id": "test_hotel", "master_id": 17, "rates": rates}
            )
        hotel = catalog()
        if failure == "identity":
            hotel["masterId"] = 18
        if failure == "catalog":
            return httpx.Response(200, text="No page data")
        payload = json.dumps({"props": {"pageProps": {"hotel": hotel}}})
        return httpx.Response(
            200, text=f'<script id="__NEXT_DATA__" type="application/json">{payload}</script>'
        )

    base = OfferLookup((), datetime(2026, 10, 26, tzinfo=UTC))
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await OstrovokDetails(client).enrich(
            row(), base, date(2026, 11, 2), date(2026, 11, 4), 2
        )
    assert result.rates_complete is (failure not in {"rates", "room_identity"})
    if result.rates_complete:
        assert len(result.offers) == 2
        assert {offer.room_group_id for offer in result.offers} == {"group-1"}
        assert result.offers[0].free_cancellation_before == datetime(2026, 11, 1, 12, tzinfo=UTC)
    if failure in {"catalog", "identity"}:
        assert result.room_groups == ()
    else:
        assert len(result.room_groups) == 2
        assert result.room_groups[0].photos == (
            "https://cdn.ostrovok.ru/t/1024x768/room-1.jpg",
            "https://cdn.ostrovok.ru/t/1024x768/room-2.jpg",
        )
        assert result.room_groups[1].photos == ()
        assert result.room_groups[1].size_sqm is None
