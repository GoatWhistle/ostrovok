from typing import Any, cast
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from hotel_agent.application.use_cases.compare_hotels import (
    CompareHotels,
    Comparison,
    ComparisonRow,
)
from hotel_agent.interfaces.http.routers.compare import build_router


def test_comparison_matches_published_shape(contract: dict[str, Any]) -> None:
    compare = AsyncMock(
        return_value=Comparison(
            characteristic_keys=("distance_to_sea",),
            rows=(ComparisonRow(hotel_id="a", cells={}), ComparisonRow(hotel_id="b", cells={})),
        )
    )
    app = FastAPI()
    app.include_router(build_router(cast(CompareHotels, compare)))
    with TestClient(app) as client:
        response = client.post("/compare", json={"hotel_ids": ["a", "b"]})
    assert response.status_code == 200
    schema = contract["paths"]["/compare"]["post"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    Draft202012Validator(schema).validate(response.json())
    assert [row["hotel_id"] for row in response.json()["rows"]] == ["a", "b"]
