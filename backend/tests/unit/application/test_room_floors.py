from hotel_agent.application.room_floors import confirms_floor, reaches, with_known_floor
from hotel_agent.application.room_records import RoomRecord


def room(floor_min: int | None = None, floor_max: int | None = None) -> RoomRecord:
    return RoomRecord(
        id="r",
        name="Номер",
        capacity=2,
        floor_min=floor_min,
        floor_max=floor_max,
        facade_ids=(),
        price_amount=None,
        price_currency=None,
        included=(),
    )


def test_a_room_without_any_floor_confirms_nothing() -> None:
    assert reaches(room(), 5) is False
    assert confirms_floor([room(), room()], 5) is False


def test_a_room_range_covering_the_floor_confirms_it() -> None:
    assert reaches(room(4, 7), 5) is True
    assert reaches(room(6, 9), 5) is False


def test_an_open_ended_range_is_read_from_the_side_that_is_known() -> None:
    assert reaches(room(5, None), 7) is True
    assert reaches(room(5, None), 4) is False
    assert reaches(room(None, 5), 3) is True
    assert reaches(room(None, 5), 9) is False


def test_known_floors_are_counted_not_guessed() -> None:
    assert with_known_floor([room(), room(2, 3), room(None, 4)]) == 2
    assert with_known_floor([]) == 0
