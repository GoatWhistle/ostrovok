from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class HotelPhotoRecord:
    url: str
    source_url: str | None = None
    kind: Literal["hotel", "room", "surroundings"] = "hotel"
