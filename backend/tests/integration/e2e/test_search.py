import os
from pathlib import Path

from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import load_settings


def test_seeded_search_and_geo_features() -> None:
    root = Path(__file__).resolve().parents[4]
    settings = load_settings({**os.environ, "CHARACTERISTICS_DIR": str(root / "characteristics")})
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/v1/search",
            json={
                "query": "тихий номер в Сочи с видом на закат недалеко от моря",
                "region_id": "sochi",
            },
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["results"], "Run make seed and make precompute before integration tests"
        assert data["results"][0]["hotel"]["location"]
        matched = data["results"][0]["matched"]
        sea = next(item for item in matched if item["characteristic_key"] == "distance_to_sea")
        assert sea["match"] in {"full", "partial"}
        assert sea["geo_refs"]
        features = client.post("/api/v1/geo-features:batch", json={"ids": sea["geo_refs"]})
        assert features.status_code == 200, features.text
        assert features.json()["features"][0]["geometry"]["type"] == "LineString"
        hotel_id = data["results"][0]["hotel"]["id"]
        card = client.get(f"/api/v1/hotels/{hotel_id}")
        scene = client.get(f"/api/v1/hotels/{hotel_id}/scene")
        assert card.status_code == 200, card.text
        assert scene.status_code == 200, scene.text
        assert card.json()["facts"]
        fact_id = card.json()["facts"][0]["fact_id"]
        detail = client.get(f"/api/v1/hotels/{hotel_id}/facts/{fact_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["fact_id"] == fact_id
        assert detail.json()["history"] == []
        assert scene.json()["building"]["features"]
        assert scene.json()["facades"]
        unsupported = client.post(
            "/api/v1/search",
            json={
                "query": "отель в Сочи с вертолётной площадкой",
                "region_id": "sochi",
            },
        )
        assert unsupported.status_code == 200, unsupported.text
        assert unsupported.json()["parsed"]["intents"] == []
        assert unsupported.json()["results"]
        assert unsupported.json()["results"][0]["matched"] == []
