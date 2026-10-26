import os
from pathlib import Path

import psycopg
from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import load_settings


def test_compare_reads_real_facts_and_validates_selection() -> None:
    root = Path(__file__).resolve().parents[4]
    settings = load_settings(
        {**os.environ, "CHARACTERISTICS_DIR": str(root / "characteristics"), "LLM_PROVIDER": "fake"}
    )
    with psycopg.connect(settings.database_url) as connection:
        ids = [
            row[0]
            for row in connection.execute(
                "SELECT h.id FROM hotels h JOIN facts f ON f.subject_id=h.id "
                "WHERE h.region_id='sochi' AND h.name<>h.id AND f.subject_type='hotel' "
                "GROUP BY h.id ORDER BY h.id LIMIT 5"
            )
        ]
    assert len(ids) == 5, "Seed five Sochi hotels with facts before this check"
    with TestClient(create_app(settings)) as client:
        for count in (2, 5):
            response = client.post("/api/v1/compare", json={"hotel_ids": ids[:count]})
            assert response.status_code == 200, response.text
            result = response.json()
            assert [row["hotel_id"] for row in result["rows"]] == ids[:count]
            assert result["characteristic_keys"]
            assert all(row["cells"] for row in result["rows"])
        duplicate = client.post("/api/v1/compare", json={"hotel_ids": [ids[0], ids[1], ids[0]]})
        assert len(duplicate.json()["rows"]) == 2
        missing = client.post("/api/v1/compare", json={"hotel_ids": [ids[0], "does-not-exist"]})
        assert missing.status_code == 404
        assert missing.json()["code"] == "not_found"
        for selected in ([ids[0]], ids + [ids[0]]):
            assert client.post("/api/v1/compare", json={"hotel_ids": selected}).status_code == 422
