from dataclasses import replace

from hotel_agent.adapters.geo.window_candidates import WindowCandidates
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.view_geometry import PhysicalObject
from tests.unit.adapters.test_view_components import PartsGeometry
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


async def test_complex_target_does_not_spend_all_rays_on_first_hotels() -> None:
    geometry = PartsGeometry()
    geometry.parts = tuple(
        PhysicalObject(
            f"part{i}",
            {"building:part": "yes", "height": str(20 + i)},
            square(39.01, 0.00001),
            "test:part",
        )
        for i in range(30)
    )
    hotels = tuple(replace(hotel(), id=f"hotel{i}") for i in range(10))
    prepared = await WindowCandidates(geometry).prepare(
        hotels,
        request(),
        {h.id: NamedPlaceRecord(id="n20", name="Fortress", location=(39.01, 43)) for h in hotels},
        {},
    )
    assert len(prepared.rays) <= 216
    assert {ray.hotel_id for ray in prepared.rays} == {h.id for h in hotels}
    assert not prepared.unchecked
    counts = [sum(ray.hotel_id == h.id for ray in prepared.rays) for h in hotels]
    assert max(counts) - min(counts) <= 1


async def test_many_hotels_still_check_distinct_target_parts_and_dome_apex() -> None:
    hotels = tuple(replace(hotel(), id=f"hotel{i}") for i in range(64))
    prepared = await WindowCandidates(PartsGeometry()).prepare(
        hotels,
        request(),
        {h.id: NamedPlaceRecord(id="n20", name="Собор", location=(39.01, 43)) for h in hotels},
        {},
    )
    for candidate in hotels:
        rays = [ray for ray in prepared.rays if ray.hotel_id == candidate.id]
        assert {ray.target.id for ray in rays} >= {"cross", "n20", "dome"}
        assert any(ray.target.id == "dome" and ray.target_height.minimum_m >= 95 for ray in rays)


async def test_known_requested_floor_is_prioritized_over_nearer_short_hotels() -> None:
    short = tuple(
        replace(
            hotel(),
            id=f"short{i}",
            location=(39.009, 43),
            footprint=square(39.009),
            levels=1,
            height_m=4,
        )
        for i in range(64)
    )
    tall = replace(hotel(), id="tall", levels=20)
    hotels = (*short, tall)
    prepared = await WindowCandidates(Geometry()).prepare(
        hotels,
        request(floor=10),
        {h.id: NamedPlaceRecord(id="n20", name="Башня", location=(39.01, 43)) for h in hotels},
        {},
    )
    assert any(ray.hotel_id == tall.id and 10 in ray.floors for ray in prepared.rays)
    assert tall.id not in prepared.unchecked
