from dataclasses import dataclass


@dataclass(frozen=True, slots=True, kw_only=True)
class RoomRecord:
    id: str
    name: str
    capacity: int
    floor_min: int | None
    floor_max: int | None
    facade_ids: tuple[str, ...]
    price_amount: float | None
    price_currency: str | None
    included: tuple[str, ...]
    views: tuple[str, ...] = ()
    declared_source: str | None = None
    page_url: str | None = None
