from hotel_agent.adapters.geo.facades import FootprintFacadeExtractor
from hotel_agent.application.ports.facades import BuildingFootprint


def test_square_facades_point_outward_even_when_ring_is_reversed() -> None:
    ring = [
        [39.7, 43.5],
        [39.7002, 43.5],
        [39.7002, 43.5002],
        [39.7, 43.5002],
        [39.7, 43.5],
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
