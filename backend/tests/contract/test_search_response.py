from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.search_selection import Rejection
from hotel_agent.application.use_cases.search_hotels import (
    AskedHotelier,
    SearchOutcome,
    SearchResult,
)
from hotel_agent.domain.query import ParsedQuery
from hotel_agent.domain.services.scoring import score
from hotel_agent.interfaces.http.search_schemas import search_schema
from tests.unit.application.test_search_rejections import hotel, wanted


def test_a_rejected_hotel_matches_the_contract(characteristics_dir: Path, validate: Any) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    outcome = SearchOutcome(
        query_id="q",
        parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
        results=(),
        rejected=(
            Rejection(
                hotel=hotel("h2", "Не подошёл"),
                cause="requirement_unmet",
                closeness=0.5,
                characteristic_key="pets_policy",
            ),
            Rejection(
                hotel=hotel("h3", "Отклонён проверкой"),
                cause="review",
                closeness=0.25,
                detail="Цитата не подтверждает вид на закат",
            ),
        ),
    )

    payload = search_schema(outcome, registry, 0).model_dump(mode="json")

    validate("SearchResponse", payload)
    for item in payload["rejected"]:
        validate("RejectedHotel", item)
    assert [item["cause"] for item in payload["rejected"]] == ["requirement_unmet", "review"]
    assert payload["rejected"][0]["characteristic_key"] == "pets_policy"
    assert payload["rejected"][1]["detail"]


def test_a_search_without_rejections_still_matches_the_contract(
    characteristics_dir: Path, validate: Any
) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    outcome = SearchOutcome(
        query_id="q",
        parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
        results=(),
    )

    payload = search_schema(outcome, registry, 0).model_dump(mode="json")

    validate("SearchResponse", payload)
    assert payload["rejected"] == []


def test_an_unknown_condition_points_at_the_open_question(
    characteristics_dir: Path, validate: Any
) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    outcome = SearchOutcome(
        query_id="q",
        parsed=ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи"),
        results=(
            SearchResult(
                hotel=hotel("h1", "Неизвестно"),
                scored=score((wanted("pets_policy", True, required=False),), {}, datetime.now(UTC)),
            ),
        ),
        asked=(
            AskedHotelier(
                hotel_id="h1",
                characteristic_key="pets_policy",
                question_id="q_h1_pets_policy",
            ),
        ),
    )

    payload = search_schema(outcome, registry, 0).model_dump(mode="json")

    validate("SearchResponse", payload)
    matched = payload["results"][0]["matched"][0]
    validate("MatchedProperty", matched)
    assert matched["match"] == "unknown"
    assert matched["hotelier_question_id"] == "q_h1_pets_policy"
