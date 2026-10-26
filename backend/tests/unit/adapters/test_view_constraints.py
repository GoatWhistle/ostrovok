from hotel_agent.adapters.llm.query_payload import spatial_request
from hotel_agent.application.spatial_matching import spatial_key


def test_window_floor_and_direction_survive_model_output_without_default_invention() -> None:
    query = "в Сочи западные окна с восьмого этажа и вид на море"
    parsed = spatial_request(
        {
            "kind": "sea_view",
            "target": None,
            "radius_m": 2000,
            "source_text": "вид на море",
            "floor_min": 8,
            "floor_max": 8,
            "facade_azimuth_deg": 270,
        },
        query,
    )
    assert parsed is not None
    assert (parsed.floor_min, parsed.floor_max, parsed.facade_azimuth_deg) == (8, 8, 270)
    unspecified = spatial_request(
        {"kind": "sea_view", "radius_m": 2000, "source_text": "вид на море"}, query
    )
    assert unspecified is not None
    assert (unspecified.floor_min, unspecified.floor_max, unspecified.facade_azimuth_deg) == (
        None,
        None,
        None,
    )
    assert spatial_key(parsed) != spatial_key(unspecified)


def test_mountain_view_retains_long_distance_instead_of_clamping_to_fifty_kilometres() -> None:
    parsed = spatial_request(
        {
            "kind": "landmark_view",
            "target": "Эльбрус",
            "radius_m": 100000,
            "source_text": "вид на Эльбрус",
        },
        "Кисловодск, вид на Эльбрус",
    )
    assert parsed is not None
    assert parsed.radius_m == 100000
