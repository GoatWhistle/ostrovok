import shutil
from dataclasses import replace
from pathlib import Path

from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import Settings

ADDED = """
key: pool_heated
title_ru: Подогреваемый бассейн
description: "Бассейн с подогревом со слов отельера."
value_type: bool
unit: null
scope: hotel
conflict_tolerance: 0
tool: null
ttl_days: 365
precompute: false
ask_hotelier_if_missing: true
question_template: "Подогревается ли бассейн в {hotel}?"
source_kinds: [hotelier]
display:
  icon: pool
  color: "#00ACC1"
  geo_style: polygon
synonyms: [бассейн с подогревом]
matchers:
  - phrase: подогреваемый бассейн
    op: eq
    value: true
    weight: 1.0
    required: false
fields: []
"""


def test_registry_is_published_for_the_frontend(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/characteristics")

    assert response.status_code == 200
    items = response.json()["items"]
    assert {item["key"] for item in items} == {
        "blackout_curtains",
        "building_height",
        "distance_to_sea",
        "double_room",
        "noise_level",
        "pets_policy",
        "room_capacity",
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


def test_a_new_yaml_file_reaches_the_endpoint_without_code_changes(
    settings: Settings, characteristics_dir: Path, tmp_path: Path
) -> None:
    shutil.copytree(characteristics_dir, tmp_path / "characteristics")
    (tmp_path / "characteristics" / "pool_heated.yaml").write_text(ADDED, encoding="utf-8")

    with TestClient(
        create_app(replace(settings, characteristics_dir=tmp_path / "characteristics"))
    ) as client:
        items = client.get("/api/v1/characteristics").json()["items"]

    added = next(item for item in items if item["key"] == "pool_heated")
    assert added["title"] == "Подогреваемый бассейн"
    assert added["display"]["icon"] == "pool"
    assert len(items) == 9
