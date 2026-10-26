from pathlib import Path

import pytest

from hotel_agent.adapters.geo.search_areas import SearchAreas


@pytest.mark.parametrize("name", ["Дагестан", "Республика Дагестан", "Republic of Dagestan"])
def test_region_aliases_resolve_same_boundary(name: str) -> None:
    areas = SearchAreas(Path(__file__).resolve().parents[5] / "data/seed/russia-admin1.geojson")
    area = areas.resolve(name)

    assert area is not None
    assert area.contains((47.50, 42.98))
    assert area.contains((46.83, 42.39))
    assert not area.contains((46.1, 43.3))
    assert area.bbox[0] < 46.1 < area.bbox[2]
    assert area.bbox[1] < 43.3 < area.bbox[3]


def test_ordinary_city_is_not_mistaken_for_region() -> None:
    areas = SearchAreas(Path(__file__).resolve().parents[5] / "data/seed/russia-admin1.geojson")

    assert areas.resolve("Махачкала") is None
    assert areas.resolve("Несуществующий") is None


def test_federal_city_has_its_own_boundary() -> None:
    areas = SearchAreas(Path(__file__).resolve().parents[5] / "data/seed/russia-admin1.geojson")

    area = areas.resolve("Москва")

    assert area is not None
    assert area.contains((37.61, 55.75))


def test_named_geographic_object_coordinates_resolve_to_region() -> None:
    areas = SearchAreas(Path(__file__).resolve().parents[5] / "data/seed/russia-admin1.geojson")
    assert areas.region_at((87.60, 51.64)) == "Республика Алтай"
    assert areas.region_at((160.64, 56.06)) == "Камчатский край"
    assert areas.region_at((0, 0)) is None
