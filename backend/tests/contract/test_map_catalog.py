from typing import Any

from fastapi.testclient import TestClient


def test_map_catalog_matches_published_contract(client: TestClient, validate: Any) -> None:
    response = client.get("/api/v1/map/catalog")
    assert response.status_code == 200
    validate("MapCatalog", response.json())
    classes = response.json()["classes"]
    assert len(classes) == 64
    assert {item["layer"] for item in classes} == {"ground", "volume", "prop", "poi"}
