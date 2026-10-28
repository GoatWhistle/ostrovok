from dataclasses import replace

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.search_ranking import search_rank
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.scoring import Scored, score
from tests.unit.application.hotelier_fakes import NOW, computed_fact


def hotel(identifier: str, name: str) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=identifier,
        region_id="sochi",
        name=name,
        location=(39.86, 43.51),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


NEAR = hotel("near", "Яблоко")
NEXT = hotel("next", "Абрис")
FAR = hotel("far", "Аида")


def test_a_measured_wish_ranks_by_the_closer_value_not_by_hotel_name() -> None:
    wish = Intent(
        characteristic_key="distance_to_sea",
        op=Op.LTE,
        value=10.0,
        weight=1.0,
        required=False,
        source_text="у моря",
    )
    ranked = sorted(
        (
            (
                item,
                score(
                    (wish,),
                    {
                        "distance_to_sea": fact_from_record(
                            computed_fact(f"f_{item.id}", item.id, "distance_to_sea", minutes)
                        )
                    },
                    NOW,
                ),
            )
            for item, minutes in ((NEXT, 9.0), (FAR, 6.0), (NEAR, 2.0))
        ),
        key=lambda pair: search_rank(pair[0], pair[1]),
    )

    assert [pair[0].id for pair in ranked] == ["near", "far", "next"]
    assert [round(pair[1].score, 4) for pair in ranked] == sorted(
        (round(pair[1].score, 4) for pair in ranked), reverse=True
    )
    assert len({round(pair[1].score, 4) for pair in ranked}) == 3


def test_unknown_scores_keep_candidate_order_instead_of_alphabet() -> None:
    wish = Intent(
        characteristic_key="distance_to_sea",
        op=Op.LTE,
        value=10.0,
        weight=1.0,
        required=False,
        source_text="у моря",
    )
    candidates = [NEAR, FAR, NEXT]

    ranked = sorted(candidates, key=lambda item: search_rank(item, score((wish,), {}, NOW)))

    assert [item.id for item in ranked] == ["near", "far", "next"]


def test_derived_wish_ranks_by_native_measurement_behind_boolean_match() -> None:
    wish = Intent(
        characteristic_key="derived:sea",
        op=Op.EQ,
        value=True,
        weight=1.0,
        required=False,
        source_text="недалеко от моря",
    )

    def scored(item: SearchHotelRecord, minutes: float) -> Scored:
        record = replace(
            computed_fact(f"f_{item.id}", item.id, "derived:sea", True),
            qualifiers={"native_op": "lte", "native_value": minutes, "native_threshold": 10.0},
        )
        return score((wish,), {"derived:sea": fact_from_record(record)}, NOW)

    ranked = sorted(
        ((item, scored(item, minutes)) for item, minutes in ((NEXT, 7.2), (FAR, 1.3), (NEAR, 5.3))),
        key=lambda pair: search_rank(pair[0], pair[1]),
    )

    assert [pair[0].id for pair in ranked] == ["far", "near", "next"]


def test_equal_scores_fall_back_to_stars_instead_of_candidate_order() -> None:
    plain = replace(hotel("plain", "Бета"), stars=2)
    best = replace(hotel("best", "Альфа"), stars=5)
    unrated = hotel("unrated", "Гамма")
    empty = Scored(score=0.0, matches=(), disqualified=False)

    ranked = sorted((plain, unrated, best), key=lambda item: search_rank(item, empty))

    assert [item.id for item in ranked] == ["best", "plain", "unrated"]
