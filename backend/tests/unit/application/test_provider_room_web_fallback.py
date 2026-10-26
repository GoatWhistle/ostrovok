import json
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.application.agent.data_records import DataCheck, DataCriterion, DataStep
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.ports.hotel_catalog import (
    CatalogHotel,
    CatalogProviderFailure,
    CatalogRoom,
    HotelCatalogSource,
)
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort
from hotel_agent.domain.query import ParsedQuery
from tests.unit.application.test_data_explorer import NOW, build, hotel


@pytest.mark.parametrize("failure", ("unmapped", "error", "empty_rooms", "unconfigured"))
async def test_missing_provider_rooms_triggers_web_search_and_verified_page_read(
    failure: str,
) -> None:
    wish = "ванна на лапках"
    quote = "Bathrooms feature a clawfoot bathtub."
    page = WebPage("https://hotel.example/rooms", "city: rooms", f"city, Сочи. {quote}", NOW)
    web = SimpleNamespace(search=AsyncMock(return_value=[page]), read=AsyncMock(return_value=page))
    wanted = DataCriterion(
        term=wish,
        source_text=wish,
        required=False,
        explanation="",
        checks=(DataCheck(field="r1.match_count", op="gte", value=1),),
    )
    explorer, llm, _ = build(
        [
            DataStep(action="get_provider_content", arguments={"hotel_ids": ["city"]}),
            DataStep(action="read_web_page", arguments={"url": page.url, "hotel_id": "city"}),
            DataStep(action="finish", arguments={}, criteria=(wanted,)),
        ]
    )
    source = SimpleNamespace(
        get_hotel=AsyncMock(
            side_effect=CatalogProviderFailure("catalog unavailable")
            if failure == "error"
            else None,
            return_value=CatalogHotel("supplier", "city", ()),
        )
    )
    explorer._catalog = None if failure == "unconfigured" else cast(HotelCatalogSource, source)
    explorer._web = cast(WebResearchPort, web)
    if failure == "unmapped":
        async with explorer._uow() as uow:
            cast(AsyncMock, uow.search.get_supplier_id).return_value = None
    llm.verify_evidence.return_value = [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    result = await explorer(
        f"Отель в Сочи: {wish}", (wish,), "Сочи", "sochi", [hotel("city")], None, False
    )

    assert result.wish_results[0].status is WishStatus.MATCHED
    assert result.facts[0].value is True
    assert result.facts[0].source_id == page.url
    web.search.assert_awaited_once()
    query = web.search.await_args.args[0]
    assert '"city"' in query and "Сочи" in query and "номера" in query
    web.read.assert_awaited_once_with(page.url)
    context = json.loads(llm.verify_evidence.await_args.args[0])
    assert context["records"][0]["hotel_name"] == "city"
    assert context["records"][0]["source_url"] == page.url


async def test_complete_provider_room_catalog_does_not_trigger_a_web_search() -> None:
    explorer, _, _ = build([])
    web = SimpleNamespace(search=AsyncMock())
    catalog = CatalogHotel("supplier", "city", (CatalogRoom("room", "Double", 2, ("bath",)),))
    tools = DataTools(
        explorer._uow,
        explorer._terrain,
        [hotel("city")],
        "Сочи",
        "sochi",
        None,
        False,
        web=cast(WebResearchPort, web),
        catalog=cast(
            HotelCatalogSource, SimpleNamespace(get_hotel=AsyncMock(return_value=catalog))
        ),
    )
    result = await tools.execute("get_provider_content", {"hotel_ids": ["city"]})
    assert result["room_record_count"] == 1
    assert result["missing_room_hotel_ids"] == []
    web.search.assert_not_awaited()


async def test_missing_stay_fields_cannot_be_filled_with_model_invented_dates() -> None:
    explorer, _, _ = build([])
    offers = AsyncMock()
    offers.configured = True
    tools = DataTools(
        explorer._uow,
        explorer._terrain,
        [hotel("city")],
        "Сочи",
        "sochi",
        None,
        False,
        offers=offers,
        parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи", adults=2),
    )
    result = await tools.execute(
        "get_room_offers",
        {
            "hotel_ids": ["city"],
            "check_in": "2026-11-01",
            "check_out": "2026-11-02",
            "adults": 4,
        },
    )
    assert result["needs_input"] == ["check_in", "check_out"]
    offers.assert_not_awaited()
