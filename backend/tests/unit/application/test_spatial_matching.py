from datetime import UTC, datetime

from hotel_agent.application.dto import NamedPlaceRecord, SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.spatial_matching import spatial_fact, spatial_intent
from hotel_agent.domain.query import SpatialRequest
from hotel_agent.domain.services.scoring import MatchQuality, match


def test_landmark_view_is_located_but_room_view_remains_unverified() -> None:
    request = SpatialRequest(
        kind="landmark_view",
        target="монумент дружбы народов",
        radius_m=2000,
        source_text="видно монумент дружбы народов",
    )
    hotel = SearchHotelRecord(
        id="h1",
        region_id="russia",
        name="Гостиница",
        location=(53.21, 56.85),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    place = NamedPlaceRecord(
        id="w442350429", name="Навеки с Россией", location=(53.1971659, 56.852184)
    )
    now = datetime(2026, 10, 25, tzinfo=UTC)

    record = spatial_fact(request, hotel, place, now)
    found = match(spatial_intent(request), fact_from_record(record), now)

    assert found.quality is MatchQuality.UNKNOWN
    assert record.geo_refs == ("g_poi_w442350429",)
    assert "Вид из конкретного номера не подтверждён" in record.explanation


def test_center_is_estimated_and_has_map_reference() -> None:
    request = SpatialRequest(
        kind="city_center", target=None, radius_m=1500, source_text="в центре ижевска"
    )
    hotel = SearchHotelRecord(
        id="h1",
        region_id="russia",
        name="Гостиница",
        location=(53.213, 56.849),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    now = datetime(2026, 10, 25, tzinfo=UTC)

    record = spatial_fact(request, hotel, (53.21314, 56.8488), now)

    assert (
        match(spatial_intent(request), fact_from_record(record), now).quality
        is MatchQuality.PARTIAL
    )
    assert record.geo_refs[0].startswith("g_point_")
    assert "медиана координат отелей" in record.explanation


def test_minimum_landmark_distance_rejects_hotels_too_close() -> None:
    request = SpatialRequest(
        kind="landmark_distance_min",
        target="монумент Дружбы народов",
        radius_m=2000,
        source_text="не ближе 2 км к нему",
        required=True,
    )
    hotel = SearchHotelRecord(
        id="h1",
        region_id="russia",
        name="Гостиница",
        location=(53.1972, 56.8522),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    place = NamedPlaceRecord(
        id="w442350429", name="Навеки с Россией", location=(53.1971659, 56.852184)
    )
    now = datetime(2026, 10, 25, tzinfo=UTC)

    record = spatial_fact(request, hotel, place, now)

    assert (
        match(spatial_intent(request), fact_from_record(record), now).quality is MatchQuality.NONE
    )
    assert spatial_intent(request).required
    assert "Минимальное расстояние" in record.explanation


def test_sea_view_is_never_claimed_from_coast_proximity_alone() -> None:
    request = SpatialRequest(kind="sea_view", target=None, radius_m=1500, source_text="видеть море")
    hotel = SearchHotelRecord(
        id="h1",
        region_id="russia",
        name="Гостиница",
        location=(131.89, 43.12),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    now = datetime(2026, 10, 25, tzinfo=UTC)

    record = spatial_fact(request, hotel, (131.895, 43.121), now)

    assert (
        match(spatial_intent(request), fact_from_record(record), now).quality
        is MatchQuality.UNKNOWN
    )
    assert "Вид на море из номера не подтверждён" in record.explanation
