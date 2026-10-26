from dataclasses import replace

from hotel_agent.adapters.geo.window_candidates import WindowCandidates
from hotel_agent.adapters.llm.query_payload import spatial_request
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.view_geometry import PhysicalArea, PhysicalObject
from hotel_agent.application.spatial_matching import spatial_key
from hotel_agent.domain.query import SpatialRequest
from tests.unit.adapters.test_window_views import Geometry, hotel, request, square


class PartsGeometry(Geometry):
    def __init__(self) -> None:
        super().__init__()
        self.target = PhysicalObject(
            "n20", {"name": "Собор", "height": "100"}, square(39.01, 0.0003), "test:cathedral"
        )
        self.parts = (
            PhysicalObject(
                "cross",
                {"building:part": "yes", "height": "110"},
                square(39.01, 0.00001),
                "test:cross",
            ),
            PhysicalObject(
                "dome",
                {"building:part": "yes", "height": "96", "roof:shape": "dome", "roof:height": "19"},
                square(39.01, 0.0001),
                "test:dome",
            ),
        )

    async def area(self, bbox: tuple[float, float, float, float]) -> PhysicalArea:
        return PhysicalArea(bbox, self.parts, True, "test")


def component_request(value: str = "dome") -> SpatialRequest | None:
    term = "вид на купол собора"
    return spatial_request(
        {
            "kind": "landmark_view",
            "target": "Собор",
            "radius_m": 2000,
            "source_text": term,
            "target_part": "top",
            "target_component_key": "roof:shape",
            "target_component_values": [value],
        },
        term,
    )


async def test_requested_component_is_not_replaced_by_taller_unrelated_part() -> None:
    wanted = component_request()
    assert wanted is not None
    prepared = await WindowCandidates(PartsGeometry()).prepare(
        (hotel(),),
        wanted,
        {"h1": NamedPlaceRecord(id="n20", name="Собор", location=(39.01, 43))},
        {},
    )
    assert prepared.rays
    assert {ray.target.id for ray in prepared.rays} == {"dome"}


async def test_missing_requested_component_does_not_fall_back_to_entire_building() -> None:
    wanted = component_request("onion")
    assert wanted is not None
    prepared = await WindowCandidates(PartsGeometry()).prepare(
        (hotel(),),
        wanted,
        {"h1": NamedPlaceRecord(id="n20", name="Собор", location=(39.01, 43))},
        {},
    )
    assert prepared.rays == ()
    assert "част" in prepared.reasons["h1"]
    assert "h1" not in prepared.rejected


def test_component_constraints_have_distinct_cache_identity() -> None:
    dome, onion = component_request(), component_request("onion")
    assert dome is not None and onion is not None
    assert spatial_key(dome) != spatial_key(onion)
    assert spatial_key(dome) != spatial_key(replace(request(), source_text=dome.source_text))
