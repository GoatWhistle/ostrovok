from datetime import timedelta
from unittest.mock import AsyncMock

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.agent.wish_evidence import wish_key
from hotel_agent.application.agent.wish_records import WishStatus
from hotel_agent.application.dto import SearchFactRecord
from tests.unit.application.test_data_explorer import NOW, build, hotel

TERM = "где останавливался Трамп"


def stored(valid_for: timedelta) -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id="city",
        id=f"f_wish_{wish_key(TERM)[8:]}_city",
        characteristic_key=wish_key(TERM),
        value=True,
        unit=None,
        qualifiers={"source_text": TERM, "source_urls": ["https://example.org/a"]},
        source_type="computed",
        source_id="https://example.org/a",
        method="data_agent_tools@1",
        confidence=0.7,
        computed_at=NOW,
        valid_until=NOW + valid_for,
        status="active",
        geo_refs=(),
        explanation="Источник подтверждает проживание.",
        facade_azimuth=None,
    )


async def test_a_wish_verified_before_is_answered_from_the_stored_fact() -> None:
    explorer, llm, _ = build([], facts=[stored(timedelta(hours=1))])
    llm.explore_data = AsyncMock(side_effect=AssertionError("planner must not be asked"))

    outcome = await explorer(
        "отель, где останавливался Трамп", (TERM,), "Москва", "russia", [hotel("city")], None, False
    )

    assert outcome.wish_results[0].status is WishStatus.MATCHED
    assert [row.hotel_id for row in outcome.facts] == ["city"]
    llm.explore_data.assert_not_awaited()


async def test_an_expired_fact_is_checked_again() -> None:
    explorer, llm, _ = build([], facts=[stored(timedelta(hours=-1))])
    llm.explore_data = AsyncMock(
        side_effect=lambda context: DataStep(
            action="finish", arguments={}, reason="Источники об этом молчат."
        )
    )

    await explorer(
        "отель, где останавливался Трамп", (TERM,), "Москва", "russia", [hotel("city")], None, False
    )

    llm.explore_data.assert_awaited()
