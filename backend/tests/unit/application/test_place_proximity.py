from dataclasses import replace
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.dto import GeoFeatureRecord, SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory

NOW = datetime(2026, 10, 27, tzinfo=UTC)
NEAR = SearchHotelRecord(
    id="near",
    region_id="russia",
    name="Отель рядом",
    location=(37.61, 55.75),
    stars=None,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)
FAR = replace(NEAR, id="far", name="Отель далеко")


def tools(matches: dict[str, tuple[str, ...]]) -> DataTools:
    feature = GeoFeatureRecord(
        id="g_poi_p1",
        kind="poi",
        characteristic_key="spatial",
        geometry={"type": "Point", "coordinates": [37.61, 55.75]},
        name="The Бык",
        label="The Бык",
        osm_ref="p1",
        style_hint="points",
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            nearby_objects=SimpleNamespace(list_matches=AsyncMock(return_value=matches)),
            geo_features=SimpleNamespace(get_batch=AsyncMock(return_value=[feature])),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    return DataTools(
        cast(UnitOfWorkFactory, lambda: scope),
        MagicMock(),
        [NEAR, FAR],
        "Москва",
        "russia",
        None,
        False,
        now=NOW,
        terms=("рядом с The Бык",),
    )


async def test_named_place_is_measured_from_local_data_and_becomes_a_fact() -> None:
    instance = tools({"near": ("p1",), "far": ()})

    result = await instance.execute("find_nearby", {"name": "The Бык", "radius_m": 800})

    assert result["hotels_with_match"] == 1
    assert result["matches"][0]["names"] == ["The Бык"]
    assert instance.metrics["near"][result["field"]] == 1
    assert instance.metrics["far"][result["field"]] == 0

    outcome = materialize(
        "хочу отель в Москве рядом с The Бык",
        ("рядом с The Бык",),
        (
            DataCriterion(
                term="рядом с The Бык",
                source_text="рядом с The Бык",
                checks=(DataCheck(field=result["field"], op="gte", value=1),),
                required=False,
                explanation="Объект с таким названием найден рядом.",
            ),
        ),
        instance,
        NOW,
        None,
    )
    confirmed = {row.hotel_id: row.value for row in outcome.facts}
    assert confirmed == {"near": True, "far": False}
    assert "g_poi_p1" in next(row for row in outcome.facts if row.hotel_id == "near").geo_refs


@pytest.mark.parametrize(
    "arguments",
    [{"radius_m": 800}, {"name": "The Бык", "radius_m": 30}, {"name": "x", "osm_key": "hotel"}],
)
async def test_unusable_requests_are_refused(arguments: dict[str, object]) -> None:
    with pytest.raises(ValueError):
        await tools({}).execute("find_nearby", arguments)
