from dataclasses import replace
from datetime import UTC, datetime

from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.scoring import MatchQuality, match
from tests.unit.application.hotelier_fakes import computed_fact

NOW = datetime(2026, 10, 28, tzinfo=UTC)
WISH = Intent(
    characteristic_key="pets_policy",
    op=Op.EQ,
    value=True,
    weight=1.0,
    required=True,
    source_text="с собакой",
)


def policy(value: object) -> Fact:
    return fact_from_record(replace(computed_fact("f1", "h1", "pets_policy", True), value=value))


def test_a_policy_that_allows_pets_matches_the_wish() -> None:
    assert match(WISH, policy({"allowed": True, "fee_rub": 500}), NOW).quality is MatchQuality.FULL


def test_a_policy_that_forbids_pets_does_not_match() -> None:
    assert match(WISH, policy({"allowed": False}), NOW).quality is MatchQuality.NONE


def test_a_policy_without_the_flag_stays_unknown() -> None:
    assert match(WISH, policy({"terms": "по запросу"}), NOW).quality is MatchQuality.UNKNOWN
