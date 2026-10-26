import pytest

from hotel_agent.adapters.geo.facades import FootprintFacadeExtractor
from hotel_agent.application.ports.facades import BuildingFootprint


@pytest.mark.parametrize(
    "lon,lat", [(39.7, 43.5), (37.6, 55.7), (131.9, 43.1), (33.1, 69.0), (-179.9999, 66.0)]
)
def test_square_facades_point_outward_even_when_ring_is_reversed(lon: float, lat: float) -> None:
    ring = [
        [lon, lat],
        [lon + 0.0002, lat],
        [lon + 0.0002, lat + 0.0002],
        [lon, lat + 0.0002],
        [lon, lat],
    ]
    extractor = FootprintFacadeExtractor()
    usual = BuildingFootprint(
        hotel_id="h1",
        building_id="b1",
        geometry={"type": "Polygon", "coordinates": [ring]},
    )
    reversed_ring = BuildingFootprint(
        hotel_id="h1",
        building_id="b1",
        geometry={"type": "Polygon", "coordinates": [list(reversed(ring))]},
    )

    forward = extractor.extract(usual)
    backward = extractor.extract(reversed_ring)

    assert len(forward) == len(backward) == 4
    assert {round(item.azimuth_deg / 90) % 4 for item in forward} == {0, 1, 2, 3}
    assert [item.azimuth_deg for item in forward] == [item.azimuth_deg for item in backward]
    assert [item.azimuth_deg for item in forward] == [180, 90, 0, 270]
