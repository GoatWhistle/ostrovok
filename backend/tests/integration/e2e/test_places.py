import os
from pathlib import Path

from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import LLMProvider, Settings

ROOT = Path(__file__).resolve().parents[4]


def test_real_place_card_has_provenance_walk_and_not_found_errors() -> None:
    settings = Settings(
        database_url=os.environ.get(
            "DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel"
        ),
        llm_provider=LLMProvider.FAKE,
        characteristics_dir=ROOT / "characteristics",
        seed_dir=ROOT / "data/seed",
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/places/w713692556", params={"from_hotel": "n4712092442"})
        assert response.status_code == 200, response.text
        card = response.json()
        assert card["osm_ref"] == "way/713692556"
        assert card["source"]["type"] == "osm_tag"
        assert card["source"]["license"] == "ODbL"
        assert card["source"]["extracted_at"].startswith("2026-10-25")
        assert card["walk"]["mode"] == "graph"
        assert card["walk"]["minutes"] == round(card["walk"]["distance_m"] / 80, 1)
        assert all(fact["confidence"] == 0.7 for fact in card["facts"])
        geo = client.post("/api/v1/geo-features:batch", json={"ids": [card["walk"]["geo_ref"]]})
        assert geo.status_code == 200
        assert geo.json()["features"][0]["properties"]["place_id"] == card["id"]
        for path in ("/api/v1/places/missing", "/api/v1/places/w713692556?from_hotel=missing"):
            missing = client.get(path)
            assert missing.status_code == 404
            assert missing.json()["code"] == "not_found"
