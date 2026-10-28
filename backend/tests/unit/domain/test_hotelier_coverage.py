from datetime import datetime

from hotel_agent.domain.entities import FactStatus
from hotel_agent.domain.services.hotelier_coverage import coverage
from tests.unit.domain.conftest import FactMaker

KEYS = ("distance_to_sea", "noise_level", "pets_policy", "sunset_view")


def test_coverage_counts_what_the_hotelier_still_owes(make_fact: FactMaker, now: datetime) -> None:
    facts = [
        make_fact("f_1", characteristic_key="distance_to_sea"),
        make_fact("f_2", characteristic_key="noise_level", status=FactStatus.CONFIRMED_BY_HOTELIER),
        make_fact("f_3", characteristic_key="sunset_view", age_days=400.0),
    ]

    summary = coverage(KEYS, facts, (), now)

    assert (summary.total, summary.known, summary.unknown) == (4, 3, 1)
    assert summary.confirmed == 1
    assert summary.stale == 1
    assert summary.completeness == 0.75


def test_a_value_the_system_could_not_establish_is_not_known(
    make_fact: FactMaker, now: datetime
) -> None:
    facts = [make_fact("f_1", value=None, characteristic_key="pets_policy")]

    summary = coverage(KEYS, facts, (), now)

    assert summary.known == 0
    assert summary.unknown == 4


def test_superseded_versions_and_foreign_keys_are_ignored(
    make_fact: FactMaker, now: datetime
) -> None:
    facts = [
        make_fact("f_old", characteristic_key="noise_level", status=FactStatus.SUPERSEDED),
        make_fact("f_other", characteristic_key="building_height"),
    ]

    summary = coverage(KEYS, facts, (), now)

    assert summary.known == 0
    assert summary.total == 4


def test_a_disputed_characteristic_is_reported_separately(
    make_fact: FactMaker, now: datetime
) -> None:
    facts = [make_fact("f_1", characteristic_key="noise_level")]

    summary = coverage(KEYS, facts, ("noise_level", "building_height"), now)

    assert summary.disputed == 1


def test_an_empty_registry_has_no_completeness(now: datetime) -> None:
    summary = coverage((), (), (), now)

    assert summary.completeness == 0.0
    assert summary.unknown == 0
