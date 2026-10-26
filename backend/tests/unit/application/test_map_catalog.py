from pathlib import Path

import pytest

from hotel_agent.adapters.map_catalog.loader import load_catalog
from hotel_agent.application.map_catalog import MapCatalog
from hotel_agent.domain.errors import InvalidRegistry

ROOT = Path(__file__).resolve().parents[4]


@pytest.fixture
def catalog() -> MapCatalog:
    return load_catalog(ROOT / "map-catalog")


@pytest.mark.parametrize(
    ("tags", "hotel", "pois", "landuse", "area", "levels", "expected"),
    [
        ({"building": "house"}, True, [], "commercial", 100, 2, ("house", "tag")),
        ({"building": "yes"}, True, [{"shop": "yes"}], "residential", 100, 2, ("hotel", "hotel")),
        ({"building": "yes"}, False, [{"shop": "yes"}], "residential", 100, 2, ("retail", "poi")),
        ({"building": "yes"}, False, [], "industrial", 100, 2, ("factory", "landuse")),
        ({"building": "yes"}, False, [], None, 30, 1, ("shed", "size")),
        ({"building": "yes"}, False, [], None, 30, None, ("default_volume", "default")),
    ],
)
def test_building_inference_preserves_evidence_priority(
    catalog: MapCatalog,
    tags: dict[str, str],
    hotel: bool,
    pois: list[dict[str, str]],
    landuse: str | None,
    area: float,
    levels: int | None,
    expected: tuple[str, str],
) -> None:
    assert catalog.building(tags, hotel, pois, landuse, area, levels) == expected


def test_catalog_has_each_fallback_and_keeps_water_above_landuse(catalog: MapCatalog) -> None:
    assert 50 <= len(catalog.classes) <= 70
    assert catalog.classify({"natural": "water", "landuse": "residential"}, "ground").key == "water"
    assert catalog.classify({"unfamiliar": "value"}, "prop").key == "default_prop"


def test_catalog_rejects_an_empty_directory(tmp_path: Path) -> None:
    with pytest.raises(InvalidRegistry, match="one default"):
        load_catalog(tmp_path)
