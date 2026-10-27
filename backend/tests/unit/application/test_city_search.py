from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

from hotel_agent.application import progress
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.ports.semantic_search import SearchDocument, SemanticSearchPort
from hotel_agent.application.search_candidates import find_candidates
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, NearbyObjectRequest, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality


def search(
    parsed: ParsedQuery,
    city_bbox: tuple[float, float, float, float] | None = None,
    areas: SearchAreasPort | None = None,
    semantic: SemanticSearchPort | None = None,
) -> tuple[SearchHotels, SimpleNamespace, SimpleNamespace, MagicMock]:
    llm = SimpleNamespace(parse_query=AsyncMock(return_value=parsed))
    regions = SimpleNamespace(city_bbox=AsyncMock(return_value=city_bbox))
    hotel = SearchHotelRecord(
        id="m1",
        region_id="russia",
        name="Гостиница в Москве",
        location=(37.61, 55.75),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    hotels = SimpleNamespace(
        list_hotels=AsyncMock(return_value=[hotel]),
        by_ids=AsyncMock(return_value=[hotel]),
        list_facts=AsyncMock(return_value=[]),
        list_supplier_content=AsyncMock(return_value=[]),
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            regions=regions,
            search=hotels,
            nearby_objects=SimpleNamespace(),
            geo_features=SimpleNamespace(get_batch=AsyncMock(return_value=())),
            named_places=SimpleNamespace(geographic_name=AsyncMock(return_value=None)),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    clock = SimpleNamespace(now=lambda: datetime(2026, 10, 25, tzinfo=UTC))
    use_case = SearchHotels(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, lambda: scope),
        cast(ClockPort, clock),
        areas=areas,
        semantic=semantic,
    )
    return use_case, regions, hotels, scope


async def test_missing_city_asks_before_accessing_hotels() -> None:
    use_case, _, hotels, scope = search(
        ParsedQuery(intents=(), unmatched_terms=(), location_hint=None)
    )

    result = await use_case("тихий номер", "russia", None, 20)

    assert result.parsed.needs_clarification
    assert result.results == ()
    scope.__aenter__.assert_not_awaited()
    hotels.list_hotels.assert_not_awaited()


async def test_anywhere_retrieves_candidates_but_similarity_does_not_prove_underwater_room() -> (
    None
):
    semantic = SimpleNamespace(
        search=AsyncMock(
            return_value=[
                SearchDocument(
                    id="hotel:m1",
                    hotel_id="m1",
                    text="Бассейн у моря",
                    source="catalog",
                    relevance=0.99,
                )
            ]
        )
    )
    use_case, regions, hotels, _ = search(
        ParsedQuery(intents=(), unmatched_terms=("под водой",), location_hint=None, anywhere=True),
        semantic=cast(SemanticSearchPort, semantic),
    )

    result = await use_case("неважно где, хочу отель под водой", "russia", None, 20)

    assert not result.parsed.needs_clarification
    assert not result.results
    regions.city_bbox.assert_not_awaited()
    semantic.search.assert_awaited_once()
    hotels.by_ids.assert_awaited_once_with(("m1",))


async def test_city_routes_search_to_national_hotels_and_keeps_unknown_rooms() -> None:
    wanted = Intent(
        characteristic_key="room_capacity",
        op=Op.GTE,
        value=2.0,
        weight=1.0,
        required=True,
        source_text="двухместный номер",
    )
    use_case, regions, hotels, _ = search(
        ParsedQuery(intents=(wanted,), unmatched_terms=(), location_hint="Москва"),
        (37.4, 55.5, 37.9, 56.0),
    )

    result = await use_case("двухместный номер в Москве", "sochi", None, 20)

    regions.city_bbox.assert_awaited_once_with("Москва")
    hotels.list_hotels.assert_awaited_once_with("russia", (37.4, 55.5, 37.9, 56.0))
    assert len(result.results) == 1
    assert result.results[0].scored.matches[0].quality is MatchQuality.UNKNOWN


async def test_unindexed_city_is_reported_without_searching_all_russia() -> None:
    use_case, _, hotels, _ = search(
        ParsedQuery(intents=(), unmatched_terms=(), location_hint="Несуществующий")
    )

    result = await use_case("отель в Несуществующем", "russia", None, 20)

    assert result.results == ()
    assert result.parsed.unsupported_region == "Несуществующий"
    hotels.list_hotels.assert_not_awaited()


async def test_named_region_searches_inside_boundary_without_requiring_city() -> None:
    area = SimpleNamespace(bbox=(46.0, 41.0, 48.0, 44.0), contains=lambda point: point[0] > 46)
    use_case, regions, hotels, _ = search(
        ParsedQuery(intents=(), unmatched_terms=("высоко в горах",), location_hint="Дагестан"),
        areas=cast(SearchAreasPort, SimpleNamespace(resolve=lambda name: area)),
    )
    inside = SearchHotelRecord(
        id="dagestan",
        region_id="russia",
        name="Горный отель",
        location=(46.5, 42.0),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    outside = hotels.list_hotels.return_value[0]
    hotels.list_hotels.return_value = [inside, outside]

    result = await use_case(
        "хочу отель высоко в горах в Дагестане, любой город", "russia", None, 20
    )

    assert not result.parsed.needs_clarification
    assert result.parsed.unsupported_region is None
    assert [row.hotel.id for row in result.results] == ["dagestan"]
    hotels.list_hotels.assert_awaited_once_with("russia", area.bbox)
    regions.city_bbox.assert_not_awaited()


async def test_nearby_search_saves_evidence_for_later_fact_card() -> None:
    request = NearbyObjectRequest(
        osm_key="natural",
        osm_value="water",
        open_24h=False,
        radius_m=500,
        source_text="озеро поблизости",
    )
    use_case, _, hotels, scope = search(
        ParsedQuery(
            intents=(), unmatched_terms=(), location_hint="Москва", nearby_objects=(request,)
        ),
        (37.4, 55.5, 37.9, 56.0),
    )
    hotels.save_facts = AsyncMock()
    entered = scope.__aenter__.return_value
    entered.commit = AsyncMock()
    entered.nearby_objects.list_matches = AsyncMock(return_value={"m1": ("lake1",)})

    result = await use_case("отель в Москве, озеро поблизости", "russia", None, 20)

    hotels.save_facts.assert_awaited_once()
    records = hotels.save_facts.call_args.args[0]
    fact = result.results[0].scored.matches[0].fact
    assert fact is not None
    assert records[0].id == str(fact.id)
    assert records[0].geo_refs == ("g_poi_lake1",)
    entered.commit.assert_awaited_once()


async def test_geographic_object_can_supply_region_when_it_is_not_a_city() -> None:
    _, _, hotels, scope = search(ParsedQuery(intents=(), unmatched_terms=(), location_hint="озеро"))
    lookup = SimpleNamespace(coordinates=AsyncMock(return_value=(87.60, 51.64)))
    areas = SimpleNamespace(resolve=lambda name: None, region_at=lambda point: "Республика Алтай")
    result = await find_candidates(
        "у Телецкого озера",
        "Телецкое озеро",
        "russia",
        None,
        cast(UnitOfWorkFactory, lambda: scope),
        cast(SearchAreasPort, areas),
        None,
        cast(PlaceLookupPort, lookup),
    )
    assert result.location_hint == "Республика Алтай"
    assert not result.unsupported
    assert result.bbox is not None and result.bbox[0] < 87.60 < result.bbox[2]
    hotels.list_hotels.assert_awaited_once()


async def test_the_understood_request_is_reported_before_hotels_are_read() -> None:
    parsed = ParsedQuery(
        intents=(
            Intent(
                characteristic_key="noise_level",
                op=Op.LTE,
                value=3,
                weight=1.0,
                required=True,
                source_text=" тихий ",
            ),
        ),
        unmatched_terms=(),
        location_hint=None,
        adults=2,
    )
    use_case, _, _, _ = search(parsed)
    reported: list[tuple[str, dict[str, object]]] = []
    token = progress.listen(lambda stage, fields: reported.append((stage, fields)))
    try:
        await use_case("тихий номер", "russia", None, 20)
    finally:
        progress.release(token)

    assert reported == [
        ("parsing", {}),
        (
            "parsed",
            {
                "location": None,
                "intents": [{"term": "тихий", "key": "noise_level"}],
                "check_in": None,
                "check_out": None,
                "adults": 2,
            },
        ),
    ]
