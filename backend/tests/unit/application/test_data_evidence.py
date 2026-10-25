from datetime import UTC, datetime
from unittest.mock import MagicMock

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.dto import SearchHotelRecord


def test_separately_satisfied_conditions_do_not_become_a_joint_recommendation() -> None:
    hotels = [
        SearchHotelRecord(
            id=identifier,
            region_id="russia",
            name=identifier,
            location=(44.6, 43),
            stars=None,
            building_id=None,
            height_m=None,
            levels=None,
            footprint=None,
        )
        for identifier in ("city", "mountain")
    ]
    tools = DataTools(MagicMock(), MagicMock(), hotels, "Владикавказ", "russia", None, True)
    tools.metrics = {
        "city": {"m1.elevation_m": 600, "m1.relief_m": 20},
        "mountain": {"m1.elevation_m": 1600, "m1.relief_m": 600},
    }
    tools.descriptions = {"m1.elevation_m": "Высота, м", "m1.relief_m": "Перепад, м"}
    terms = ("горная местность", "не выше 900 м")
    criteria = (
        DataCriterion(
            term=terms[0],
            source_text=terms[0],
            required=False,
            explanation="",
            checks=(DataCheck(field="m1.relief_m", op="gte", value=200),),
        ),
        DataCriterion(
            term=terms[1],
            source_text=terms[1],
            required=True,
            explanation="",
            checks=(DataCheck(field="m1.elevation_m", op="lte", value=900),),
        ),
    )

    outcome = materialize(
        "горная местность не выше 900 м",
        terms,
        criteria,
        tools,
        datetime(2026, 10, 25, tzinfo=UTC),
        None,
    )

    assert outcome.question is not None
    assert "одновременно" in outcome.question
    assert "не выше 900 м" in outcome.question
    assert len(outcome.facts) == 4


def test_room_floor_cannot_be_marked_resolved_by_a_breakfast_criterion() -> None:
    hotel = SearchHotelRecord(
        id="h1",
        region_id="sochi",
        name="hotel",
        location=(39.7, 43.5),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    tools = DataTools(MagicMock(), MagicMock(), [hotel], "Сочи", "sochi", None, True)
    tools.metrics = {"h1": {"r1.match_count": 1}}
    tools.descriptions = {"r1.match_count": "Завтрак"}
    criterion = DataCriterion(
        term="на 17-м этаже",
        source_text="с включённым завтраком",
        required=False,
        explanation="",
        checks=(DataCheck(field="r1.match_count", op="gte", value=1),),
    )

    outcome = materialize(
        "номер на 17-м этаже с включённым завтраком",
        ("на 17-м этаже",),
        (criterion,),
        tools,
        datetime(2026, 10, 25, tzinfo=UTC),
        None,
    )

    assert outcome.facts == ()
    assert outcome.resolved_terms == ()
