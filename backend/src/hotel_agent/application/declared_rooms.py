from dataclasses import dataclass
from typing import Any

from hotel_agent.application.ports.supplier_details import SupplierRoom

DECLARED_SOURCE_KEY = "declared_source"


@dataclass(frozen=True, slots=True, kw_only=True)
class DeclaredRoomsRecord:
    hotel_id: str
    source: str
    page_url: str
    rooms: tuple[SupplierRoom, ...]


def declared_details(record: DeclaredRoomsRecord, room: SupplierRoom) -> dict[str, Any]:
    return {
        DECLARED_SOURCE_KEY: record.source,
        "page_url": record.page_url,
        "views": list(room.views),
        "size_sqm": room.size_sqm,
        "extra_places": room.extra_places,
        "floor_declared": room.floor is not None,
    }
