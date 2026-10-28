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


def test_every_documented_operation_is_served(client: TestClient, contract: dict[str, Any]) -> None:
    methods = {"get", "post", "put", "patch", "delete"}
    served = {
        (method, path.removeprefix("/api/v1"))
        for path, item in client.get("/openapi.json").json()["paths"].items()
        for method in item
        if method in methods
    }
    documented = {
        (method, path)
        for path, item in contract["paths"].items()
        for method in item
        if method in methods
    }

    assert served == documented
    assert len(documented) == 31


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
