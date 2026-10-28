from hotel_agent.adapters.llm.query_payload import nearby_object
from hotel_agent.domain.query import NearbyObjectRequest

QUERY = "Отель рядом с аэропортом Шереметьево"


def request(
    osm_key: str, osm_value: str, source: str, radius: int = 500
) -> NearbyObjectRequest | None:
    return nearby_object(
        {
            "osm_key": osm_key,
            "osm_value": osm_value,
            "source_text": source,
            "radius_m": radius,
        },
        f"Отель рядом с {source}",
    )


def test_an_airport_is_not_searched_within_a_walking_radius() -> None:
    parsed = request("aeroway", "aerodrome", "аэропортом Шереметьево")

    assert parsed is not None
    assert parsed.radius_m == 5000


def test_a_shop_keeps_the_walking_default() -> None:
    parsed = request("shop", "supermarket", "супермаркетом")

    assert parsed is not None
    assert parsed.radius_m == 500


def test_an_explicit_wider_radius_is_kept_for_a_large_object() -> None:
    parsed = request("aeroway", "aerodrome", "аэропортом Шереметьево", 12000)

    assert parsed is not None
    assert parsed.radius_m == 12000
