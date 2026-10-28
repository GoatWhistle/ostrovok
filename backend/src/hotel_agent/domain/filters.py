from dataclasses import dataclass
from datetime import date
from typing import Literal

FilterKind = Literal["wish", "location", "dates", "guests"]


@dataclass(frozen=True, slots=True, kw_only=True)
class SearchFilter:
    kind: FilterKind
    label: str = ""
    key: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    adults: int | None = None
