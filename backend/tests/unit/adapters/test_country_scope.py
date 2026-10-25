import json
from pathlib import Path

import pytest

from hotel_agent.adapters.geo.country_scope import CountryBoundary


def test_country_scope_includes_boundary_and_rejects_outside_points(tmp_path: Path) -> None:
    path = tmp_path / "country.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                },
            }
        )
    )
    scope = CountryBoundary(path)

    assert scope.contains((0.5, 0.5))
    assert scope.contains((1, 1))
    assert not scope.contains((1.1, 1))


def test_missing_boundary_does_not_silently_expand_into_another_country(tmp_path: Path) -> None:
    scope = CountryBoundary(tmp_path / "missing.geojson")

    with pytest.raises(ValueError, match="boundary dataset is unavailable"):
        scope.contains((44.6, 42.7))
