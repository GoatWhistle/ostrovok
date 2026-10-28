from datetime import UTC, datetime

import pytest

from hotel_agent.application.dto import FeedCursor
from hotel_agent.application.feed_cursor import decode_cursor, encode_cursor
from hotel_agent.domain.errors import InvalidQuery

CURSOR = FeedCursor(created_at=datetime(2026, 10, 28, 9, 30, tzinfo=UTC), id="n_abc")


def test_a_cursor_survives_the_round_trip() -> None:
    assert decode_cursor(encode_cursor(CURSOR)) == CURSOR


def test_no_cursor_means_the_first_page() -> None:
    assert decode_cursor(None) is None
    assert decode_cursor("   ") is None


@pytest.mark.parametrize("raw", ["n_abc", "2026-10-28T09:30:00+00:00~", "not-a-date~n_abc"])
def test_a_broken_cursor_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidQuery):
        decode_cursor(raw)


def test_a_cursor_without_a_time_zone_is_rejected() -> None:
    with pytest.raises(InvalidQuery):
        decode_cursor("2026-10-28T09:30:00~n_abc")
