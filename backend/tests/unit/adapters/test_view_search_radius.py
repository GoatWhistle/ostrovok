import pytest

from hotel_agent.adapters.llm.query_payload import spatial_request


@pytest.mark.parametrize("kind,target", [("landmark_view", "Бештау"), ("sea_view", None)])
def test_view_without_distance_does_not_inherit_walkable_nearby_radius(
    kind: str, target: str | None
) -> None:
    term = "с видом из номера"
    parsed = spatial_request(
        {"kind": kind, "target": target, "source_text": term, "radius_m": 0}, term
    )
    assert parsed is not None
    assert parsed.radius_m == 100000


def test_explicit_view_distance_is_preserved() -> None:
    term = "вид на башню не дальше километра"
    parsed = spatial_request(
        {"kind": "landmark_view", "target": "башня", "source_text": term, "radius_m": 1000}, term
    )
    assert parsed is not None
    assert parsed.radius_m == 1000


def test_nearby_distance_default_remains_local() -> None:
    term = "рядом с башней"
    parsed = spatial_request(
        {"kind": "landmark_nearby", "target": "башня", "source_text": term, "radius_m": 0}, term
    )
    assert parsed is not None
    assert parsed.radius_m == 500
