import json
from pathlib import Path

import pytest

from hotel_agent.adapters.seed import files
from hotel_agent.adapters.seed.store import GeoJsonSeedStore
from hotel_agent.application.dto import Feature
from hotel_agent.domain.errors import InvalidValue

HOTEL = Feature(
    id="n1",
    geometry={"type": "Point", "coordinates": [39.71, 43.57]},
    properties={"name": "Приморская", "tourism": "hotel"},
)


def test_a_layer_round_trips_through_disk(tmp_path: Path) -> None:
    size = files.write_layer(tmp_path, "hotels", [HOTEL])

    assert size > 0
    assert files.read_layer(tmp_path, "hotels") == [HOTEL]


def test_an_empty_layer_is_still_valid_geojson(tmp_path: Path) -> None:
    files.write_layer(tmp_path, "beaches", [])

    document = json.loads((tmp_path / "beaches.geojson").read_text(encoding="utf-8"))
    assert document == {"type": "FeatureCollection", "features": []}


def test_cyrillic_names_are_written_as_text_not_escapes(tmp_path: Path) -> None:
    files.write_layer(tmp_path, "hotels", [HOTEL])

    assert "Приморская" in (tmp_path / "hotels.geojson").read_text(encoding="utf-8")


def test_a_missing_layer_is_reported(tmp_path: Path) -> None:
    with pytest.raises(InvalidValue, match="is missing"):
        files.read_layer(tmp_path, "hotels")


def test_meta_round_trips(tmp_path: Path) -> None:
    files.write_meta(tmp_path, {"region": "sochi", "counts": {"hotels": 1}})

    assert files.read_meta(tmp_path)["region"] == "sochi"


def test_the_store_writes_through_the_same_files(tmp_path: Path) -> None:
    store = GeoJsonSeedStore(tmp_path)

    store.save_layer("hotels", [HOTEL])
    store.save_meta({"region": "sochi"})

    assert files.read_layer(tmp_path, "hotels") == [HOTEL]
    assert files.read_meta(tmp_path) == {"region": "sochi"}
