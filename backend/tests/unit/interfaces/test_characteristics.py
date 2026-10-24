from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import Settings


def test_registry_is_published_for_the_frontend(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/characteristics")

    assert response.status_code == 200
    items = response.json()["items"]
    assert {item["key"] for item in items} == {
        "bars_nearby",
        "blackout_curtains",
        "building_height",
        "distance_to_sea",
        "noise_level",
        "pets_policy",
        "sunset_view",
    }


def test_each_item_carries_display_hints(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        items = client.get("/api/v1/characteristics").json()["items"]

    sea = next(item for item in items if item["key"] == "distance_to_sea")
    assert sea["title"] == "Пешком до моря"
    assert sea["unit"] == "min"
    assert sea["scope"] == "hotel"
    assert sea["display"] == {"icon": "waves", "color": "#1E88E5", "geo_style": "line"}
    assert sea["source_kinds"] == ["osm", "dem", "computed"]
