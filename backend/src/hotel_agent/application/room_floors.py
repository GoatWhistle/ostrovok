from collections.abc import Sequence

from hotel_agent.application.room_records import RoomRecord


def reaches(room: RoomRecord, floor: int) -> bool:
    if room.floor_min is None and room.floor_max is None:
        return False
    low = room.floor_min if room.floor_min is not None else floor
    high = room.floor_max if room.floor_max is not None else floor
    return low <= floor <= high


def confirms_floor(rooms: Sequence[RoomRecord], floor: int) -> bool:
    return any(reaches(room, floor) for room in rooms)


def with_known_floor(rooms: Sequence[RoomRecord]) -> int:
    return sum(room.floor_min is not None or room.floor_max is not None for room in rooms)
