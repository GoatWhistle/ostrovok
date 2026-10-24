from typing import Any

import pytest
from fastapi.testclient import TestClient
from openapi_spec_validator import validate as validate_spec


def test_contract_file_is_a_valid_openapi_document(contract: dict[str, Any]) -> None:
    validate_spec(contract)


def test_health_matches_the_contract(client: TestClient, contract: dict[str, Any]) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    expected = contract["paths"]["/health"]["get"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]["properties"]
    assert set(response.json()) == set(expected)


def test_characteristics_match_the_contract(client: TestClient, validate: Any) -> None:
    response = client.get("/api/v1/characteristics")

    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    for item in items:
        validate("Characteristic", item)


def test_contract_paths_are_served_or_still_missing(
    client: TestClient, contract: dict[str, Any]
) -> None:
    served = {path.removeprefix("/api/v1") for path in client.get("/openapi.json").json()["paths"]}

    assert served <= set(contract["paths"]), "a served route is absent from the contract"


def test_validator_rejects_a_payload_that_breaks_the_contract(validate: Any) -> None:
    broken = {
        "key": "distance_to_sea",
        "title": "Пешком до моря",
        "value_type": "duration",
        "scope": "hotel",
        "unit": None,
    }

    with pytest.raises(AssertionError, match="value_type"):
        validate("Characteristic", broken)
