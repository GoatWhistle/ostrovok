from datetime import datetime

import pytest

from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.entities import FactStatus, Resolution
from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.services.conflict_resolver import RULE, resolve
from hotel_agent.domain.value_objects import ConflictId
from tests.unit.domain.conftest import FactMaker

CONFLICT = ConflictId("c_1")


def test_the_hotelier_beats_a_fresh_calculation(make_fact: FactMaker, now: datetime) -> None:
    hotelier = make_fact("f_hotelier", False, source=SourceType.HOTELIER, confidence=0.7)
    computed = make_fact("f_computed", True, source=SourceType.COMPUTED, confidence=0.95)

    resolved = resolve([computed, hotelier], now, tolerance=0.0, conflict_id=CONFLICT)

    assert resolved.winner.id == "f_hotelier"
    assert [fact.status for fact in resolved.losers] == [FactStatus.SUPERSEDED]
    assert resolved.conflict is not None
    assert resolved.conflict.resolution is Resolution.RESOLVED_BY_RULE
    assert resolved.conflict.winner_fact_id == "f_hotelier"
    assert resolved.conflict.rule == RULE


def test_a_fresh_calculation_beats_an_osm_tag(make_fact: FactMaker, now: datetime) -> None:
    osm = make_fact("f_osm", 12.0, source=SourceType.OSM, confidence=0.9)
    computed = make_fact("f_computed", 6.0, source=SourceType.COMPUTED, confidence=0.6)

    resolved = resolve([osm, computed], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.winner.id == "f_computed"


def test_an_osm_tag_beats_a_stale_calculation(make_fact: FactMaker, now: datetime) -> None:
    osm = make_fact("f_osm", 12.0, source=SourceType.OSM, confidence=0.4)
    stale = make_fact("f_old", 6.0, source=SourceType.COMPUTED, confidence=0.95, age_days=400.0)

    resolved = resolve([stale, osm], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.winner.id == "f_osm"


def test_values_inside_the_tolerance_are_not_a_conflict(
    make_fact: FactMaker, now: datetime
) -> None:
    first = make_fact("f_1", 6.0, confidence=0.9)
    second = make_fact("f_2", 7.0, source=SourceType.OSM, confidence=0.5)

    resolved = resolve([first, second], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.conflict is None
    assert resolved.winner.id == "f_1"
    assert [fact.status for fact in resolved.losers] == [FactStatus.ACTIVE]


def test_close_calls_inside_one_tier_wait_for_the_hotelier(
    make_fact: FactMaker, now: datetime
) -> None:
    first = make_fact("f_1", 6.0, confidence=0.80)
    second = make_fact("f_2", 14.0, confidence=0.78)

    resolved = resolve([first, second], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.conflict is not None
    assert resolved.conflict.resolution is Resolution.PENDING
    assert resolved.conflict.winner_fact_id is None
    assert resolved.winner.status is FactStatus.CONFLICTED
    assert [fact.status for fact in resolved.losers] == [FactStatus.CONFLICTED]


def test_a_clear_gap_inside_one_tier_is_resolved_by_rule(
    make_fact: FactMaker, now: datetime
) -> None:
    first = make_fact("f_1", 6.0, confidence=0.95)
    second = make_fact("f_2", 14.0, confidence=0.40)

    resolved = resolve([first, second], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.conflict is not None
    assert resolved.conflict.resolution is Resolution.RESOLVED_BY_RULE
    assert resolved.conflict.fact_ids == ("f_1", "f_2")


def test_a_lone_expired_fact_is_marked_stale(make_fact: FactMaker, now: datetime) -> None:
    expired = make_fact("f_1", 6.0, age_days=400.0)

    resolved = resolve([expired], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.winner.status is FactStatus.STALE
    assert resolved.conflict is None


def test_facts_still_being_computed_do_not_take_part(make_fact: FactMaker, now: datetime) -> None:
    pending = make_fact("f_pending", None, status=FactStatus.COMPUTING)
    known = make_fact("f_known", 6.0)

    resolved = resolve([pending, known], now, tolerance=2.0, conflict_id=CONFLICT)

    assert resolved.winner.id == "f_known"
    assert resolved.losers == ()


def test_resolving_only_computing_facts_is_refused(make_fact: FactMaker, now: datetime) -> None:
    pending = make_fact("f_pending", None, status=FactStatus.COMPUTING)

    with pytest.raises(InvalidValue, match="still computing"):
        resolve([pending], now, tolerance=2.0, conflict_id=CONFLICT)


def test_booleans_never_fall_inside_a_numeric_tolerance(
    make_fact: FactMaker, now: datetime
) -> None:
    yes = make_fact("f_yes", True, source=SourceType.HOTELIER, confidence=0.9)
    no = make_fact("f_no", False, source=SourceType.OSM, confidence=0.9)

    resolved = resolve([yes, no], now, tolerance=5.0, conflict_id=CONFLICT)

    assert resolved.conflict is not None
    assert resolved.winner.id == "f_yes"
