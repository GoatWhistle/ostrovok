from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.solar_position import solar_position
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort

NOW = datetime(2026, 10, 26, 9, tzinfo=UTC)
HOTEL = SearchHotelRecord(
    id="h1",
    region_id="russia",
    name="Отель",
    location=(39.72, 43.58),
    stars=None,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)


def tools(
    web: WebResearchPort | None = None,
    conditions: DestinationConditionsPort | None = None,
    llm: LLMPort | None = None,
) -> DataTools:
    return DataTools(
        MagicMock(),
        MagicMock(),
        [HOTEL],
        "Сочи",
        "russia",
        None,
        False,
        web=web,
        conditions=conditions,
        now=NOW,
        evidence=DocumentEvidence(llm, ("под водой",)) if llm else None,
    )


@pytest.mark.parametrize(
    ("at", "lon", "lat", "azimuth", "altitude"),
    [
        ("2026-06-21T12:00:00+03:00", 39.72, 43.58, 164.963, 69.318),
        ("2026-10-26T18:00:00+12:00", 160.64, 56.06, 250.415, -1.494),
        ("2026-06-21T00:00:00+03:00", 33.08, 68.97, 348.673, 3.079),
    ],
)
def test_solar_matches_suncalc_reference_including_polar_day_and_timezones(
    at: str, lon: float, lat: float, azimuth: float, altitude: float
) -> None:
    measured = solar_position(datetime.fromisoformat(at), lon, lat)
    assert measured["sun_azimuth_deg"] == pytest.approx(azimuth, abs=0.4)
    assert measured["sun_altitude_deg"] == pytest.approx(altitude, abs=0.4)


async def test_forecast_metric_is_bound_to_datetime_source_and_hotel() -> None:
    provider = SimpleNamespace(forecast=AsyncMock(return_value={"h1": {"temperature_c": 23.0}}))
    instance = tools(conditions=cast(DestinationConditionsPort, provider))
    result = await instance.execute("get_weather", {"at": NOW.isoformat()})
    field = next(iter(result["fields"]))
    criterion = DataCriterion(
        term="теплее 20 градусов",
        source_text="теплее 20 градусов",
        checks=(DataCheck(field=field, op="gte", value=20),),
        required=False,
        explanation="",
    )
    outcome = materialize(
        "теплее 20 градусов", (criterion.term,), (criterion,), instance, NOW, None
    )
    assert outcome.facts[0].value is True
    assert outcome.facts[0].qualifiers["source_urls"] == ["https://open-meteo.com/en/docs"]
    assert NOW.isoformat() in outcome.facts[0].explanation
    provider.forecast.assert_awaited_once_with({"h1": HOTEL.location}, NOW)
    with pytest.raises(ValueError, match="offset"):
        await instance.execute("calculate_sun", {"at": "2026-10-26T12:00:00"})


async def test_web_search_is_not_evidence_but_verified_page_has_citation() -> None:
    quote = "Номера отеля находятся под водой на глубине пять метров."
    web = SimpleNamespace(
        search=AsyncMock(return_value=[WebPage("https://example.org/hotel", "Отель", quote, NOW)]),
        read=AsyncMock(return_value=WebPage("https://example.org/hotel", "Отель Сочи", quote, NOW)),
    )
    llm = SimpleNamespace(
        verify_evidence=AsyncMock(
            return_value=[EvidenceVerdict(record_id="0", supported=True, quote=quote)]
        )
    )
    instance = tools(cast(WebResearchPort, web), llm=cast(LLMPort, llm))
    await instance.execute("search_web", {"query": "Отель Сочи под водой"})
    assert instance.metrics == {}
    await instance.execute("read_web_page", {"url": "https://example.org/hotel", "hotel_id": "h1"})
    assert instance.metrics == {}
    read = await instance.execute(
        "read_records",
        {
            "dataset": "web_documents",
            "term": "под водой",
            "filters": [{"field": "text", "op": "contains", "value": quote}],
        },
    )
    assert instance.metrics["h1"][read["field"]] == 1
    assert instance.reader.source_urls["h1"][read["field"]] == ("https://example.org/hotel",)
    assert "hotel_name" in llm.verify_evidence.call_args.args[0]


async def test_unverified_page_cannot_mark_a_wish_as_satisfied() -> None:
    llm = SimpleNamespace(verify_evidence=AsyncMock(return_value=[]))
    instance = tools(llm=cast(LLMPort, llm))
    instance.research.pages = [
        {"hotel_id": "h1", "text": "Подводная улица", "source_url": "https://example.org"}
    ]
    await instance.execute(
        "read_records",
        {
            "dataset": "web_documents",
            "term": "под водой",
            "filters": [{"field": "text", "op": "contains", "value": "Подводная"}],
        },
    )
    assert instance.metrics == {}


async def test_read_page_verifies_wish_immediately_without_spending_another_tool_step() -> None:
    quote = "Бассейн работает круглый год независимо от погоды."
    term = "круглогодичный бассейн"
    page = WebPage(
        "https://example.org/hotel",
        "Отель",
        quote + " Текст страницы." * 800 + " https://example.org/hotel",
        NOW,
    )
    web = SimpleNamespace(read=AsyncMock(return_value=page))

    async def verify(context: str) -> list[EvidenceVerdict]:
        assert quote in context
        return [EvidenceVerdict(record_id="0", supported=True, quote=quote)]

    llm = SimpleNamespace(verify_evidence=AsyncMock(side_effect=verify))
    instance = DataTools(
        MagicMock(),
        MagicMock(),
        [HOTEL],
        "Сочи",
        "russia",
        None,
        False,
        web=cast(WebResearchPort, web),
        now=NOW,
        terms=(term,),
        evidence=DocumentEvidence(cast(LLMPort, llm), (term,)),
    )

    result = await instance.execute("read_web_page", {"url": page.url, "hotel_ids": ["h1"]})

    field = next(iter(result["fields"]))
    assert instance.metrics["h1"][field] == 1
    assert instance.reader.quotes["h1"][field] == (quote,)
    assert instance.reader.source_urls["h1"][field] == (page.url,)
