from datetime import UTC, datetime

from hotel_agent.adapters.geo.geographic_objects import GeographicShape
from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.geographic_distance import geographic_distance
from hotel_agent.application.ports.view_geometry import PhysicalObject
from hotel_agent.application.spatial_matching import distance_m
from hotel_agent.domain.query import SpatialRequest


def test_large_lake_scope_includes_both_ends_and_excludes_distant_inland() -> None:
    lake = GeographicShape(
        PhysicalObject(
            "r1",
            {"natural": "water"},
            {
                "type": "Polygon",
                "coordinates": [[[104, 51], [105, 51], [105, 56], [104, 56], [104, 51]]],
            },
            "local:osm",
        )
    )
    area = lake.area(10000)
    assert area.contains((103.999, 51.01))
    assert area.contains((105.001, 55.99))
    assert not area.contains((108, 54))
    nearest = lake.nearest((105.001, 55.99))
    assert distance_m((105.001, 55.99), nearest) < 150
    assert nearest[1] > 55.9


def test_shore_distance_is_not_distance_to_lake_center() -> None:
    source = PhysicalObject(
        "r1",
        {"natural": "water"},
        {
            "type": "Polygon",
            "coordinates": [[[104, 51], [105, 51], [105, 56], [104, 56], [104, 51]]],
        },
        "local:osm",
    )
    hotel = SearchHotelRecord(
        id="h1",
        name="North shore",
        location=(105.001, 55.99),
        region_id="russia",
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    target = NamedPlaceRecord(id="r1", name="Long Lake", location=(104.5, 53.5))
    fact, feature = geographic_distance(
        SpatialRequest(
            kind="landmark_nearby", target=target.name, radius_m=300, source_text="on the shore"
        ),
        hotel,
        target,
        GeographicShape(source),
        datetime(2026, 10, 26, tzinfo=UTC),
    )
    assert isinstance(fact.value, int) and 0 < fact.value < 150
    assert distance_m(hotel.location, target.location) > 200000
    assert fact.geo_refs == (feature.id,)
    assert feature.osm_ref == "r1"
    assert fact.method == "geographic_boundary_distance@1"
