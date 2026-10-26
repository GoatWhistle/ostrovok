from dataclasses import replace

from hotel_agent.adapters.geo.window_candidates import WindowCandidates
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.view_geometry import PhysicalObject
from tests.unit.adapters.test_window_views import Geometry, hotel, request, square


async def test_shore_hotel_is_checked_before_hotels_near_remote_water_centroid() -> None:
    geometry = Geometry()
    geometry.target = PhysicalObject(
        "n20",
        {"natural": "water", "name": "Водохранилище"},
        {
            "type": "Polygon",
            "coordinates": [[[39, 43.001], [41, 43.001], [41, 43.01], [39, 43.01], [39, 43.001]]],
        },
        "local:water",
    )
    far = [
        replace(hotel(), id=f"far{i}", location=(40, 43.1), footprint=square(40)) for i in range(64)
    ]
    near = hotel()
    hotels = (*far, near)
    target = NamedPlaceRecord(id="n20", name="Водохранилище", location=(40, 43.005))
    prepared = await WindowCandidates(geometry).prepare(
        hotels,
        replace(request(), radius_m=20000),
        {item.id: target for item in hotels},
        {},
    )
    assert near.id not in prepared.unchecked
    assert prepared.rays[0].hotel_id == near.id
