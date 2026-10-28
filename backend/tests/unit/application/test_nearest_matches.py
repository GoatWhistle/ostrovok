from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.search_selection import NEAREST_LIMIT, nearest_matches
from hotel_agent.domain.services.scoring import Scored


def hotel(index: int) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=f"h{index}",
        region_id="sochi",
        name=f"Отель {index}",
        location=(39.86, 43.51),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


EMPTY = Scored(score=0.0, matches=(), disqualified=False)
RANKED = tuple((hotel(index), EMPTY) for index in range(30))


def test_unconfirmed_candidates_are_a_short_list_not_a_full_page() -> None:
    assert len(nearest_matches(RANKED, 20)) == NEAREST_LIMIT
    assert NEAREST_LIMIT < 20


def test_the_best_ranked_candidates_are_the_ones_kept() -> None:
    assert [item[0].id for item in nearest_matches(RANKED, 20)] == [
        f"h{index}" for index in range(NEAREST_LIMIT)
    ]


def test_a_smaller_requested_limit_still_wins() -> None:
    assert len(nearest_matches(RANKED, 3)) == 3
