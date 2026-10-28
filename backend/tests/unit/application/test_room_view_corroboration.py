from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.room_records import RoomRecord
from hotel_agent.application.room_view_corroboration import corroborate_room_views

NOW = datetime(2026, 10, 28, tzinfo=UTC)


def room(**changes: Any) -> RoomRecord:
    base: dict[str, Any] = {
        "id": "alean:hotel-1:abc",
        "name": "Люкс с видом на море",
        "capacity": 2,
        "floor_min": 4,
        "floor_max": 4,
        "facade_ids": (),
        "price_amount": None,
        "price_currency": None,
        "included": (),
        "views": ("sea",),
        "declared_source": "www.alean.ru",
        "page_url": "https://www.alean.ru/hotels/rossiya/a/b/c/d/",
    }
    return RoomRecord(**{**base, **changes})


def fact(key: str = "spatial:abc", **visibility: Any) -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id="hotel-1",
        id="f_spatial_hotel-1_abc",
        characteristic_key=key,
        value=True,
        unit=None,
        qualifiers={"visibility": {"status": "visible", "floor": 3, **visibility}},
        source_type="computed",
        source_id=None,
        method="window_view@1",
        confidence=0.7,
        computed_at=NOW,
        valid_until=NOW,
        status="active",
        geo_refs=(),
        explanation="Линия обзора свободна в расчётной модели.",
        facade_azimuth=210.0,
    )


def test_declared_category_confirms_a_visible_sea_view() -> None:
    [found] = corroborate_room_views([fact(request_kind="sea_view")], {"hotel-1": [room()]})
    visibility = found.qualifiers["visibility"]
    assert visibility["bookable_room_confirmed"] is True
    assert visibility["declared_room"]["category"] == "Люкс с видом на море"
    assert visibility["declared_room"]["floor"] == 4
    assert visibility["declared_room"]["source"] == "www.alean.ru"
    assert "«Люкс с видом на море», этаж 4" in found.explanation


def test_blocked_sightline_is_not_confirmed_by_a_declared_category() -> None:
    blocked = fact(request_kind="sea_view", status="blocked")
    [found] = corroborate_room_views([blocked], {"hotel-1": [room()]})
    assert found.qualifiers["visibility"]["bookable_room_confirmed"] is False
    assert "расчёт вид не подтвердил" in found.explanation


def test_category_below_the_computed_floor_is_still_reported_as_declared() -> None:
    low = room(floor_min=2, floor_max=2)
    [found] = corroborate_room_views([fact(request_kind="sea_view")], {"hotel-1": [low]})
    assert found.qualifiers["visibility"]["declared_room"]["floor"] == 2


def test_a_category_reaching_the_computed_floor_wins_over_one_below_it() -> None:
    low = room(id="low", name="Стандарт с видом на море", floor_min=2, floor_max=2)
    high = room(id="high", name="Люкс с видом на море", floor_min=5, floor_max=5)
    [found] = corroborate_room_views([fact(request_kind="sea_view")], {"hotel-1": [low, high]})
    assert found.qualifiers["visibility"]["declared_room"]["category"] == "Люкс с видом на море"


def test_sunset_facts_are_corroborated_by_their_own_code() -> None:
    sunset = room(name="Люкс на закат", views=("sunset",))
    [found] = corroborate_room_views([fact(key="sunset_view")], {"hotel-1": [sunset]})
    assert found.qualifiers["visibility"]["bookable_room_confirmed"] is True


def test_another_view_target_does_not_confirm_the_request() -> None:
    park = room(name="Стандарт на парк", views=("park",))
    plain = fact(request_kind="sea_view")
    [found] = corroborate_room_views([plain], {"hotel-1": [park]})
    assert found is plain
    assert "declared_room" not in found.qualifiers["visibility"]


def test_facts_without_a_visibility_block_are_untouched() -> None:
    plain = fact(request_kind="sea_view")
    stripped = replace(plain, qualifiers={})
    [found] = corroborate_room_views([stripped], {"hotel-1": [room()]})
    assert found is stripped


def test_a_hotel_without_declared_rooms_keeps_its_fact() -> None:
    plain = fact(request_kind="sea_view")
    [found] = corroborate_room_views([plain], {})
    assert found is plain


def test_a_category_below_the_computed_floor_does_not_confirm_a_bookable_room() -> None:
    low = room(floor_min=2, floor_max=2)
    [found] = corroborate_room_views([fact(request_kind="sea_view", floor=9)], {"hotel-1": [low]})
    visibility = found.qualifiers["visibility"]

    assert visibility["bookable_room_confirmed"] is False
    assert visibility["declared_room"]["floor"] == 2
    assert "этаж ниже того, с которого открывается вид" in found.explanation
