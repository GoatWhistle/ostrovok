from pydantic import BaseModel

from hotel_agent.application.use_cases.get_hotel_details import DetailsStatus, HotelDetails
from hotel_agent.interfaces.http.supplier_schemas import (
    SupplierDetailsSchema,
    SupplierRoomSchema,
    supplier_details_schema,
    supplier_room_schema,
)


class HotelDetailsSchema(BaseModel):
    hotel_id: str
    status: DetailsStatus
    source: str | None
    sandbox: bool
    details: SupplierDetailsSchema | None
    room_groups: list[SupplierRoomSchema]


def hotel_details_schema(result: HotelDetails) -> HotelDetailsSchema:
    return HotelDetailsSchema(
        hotel_id=result.hotel_id,
        status=result.status,
        source=result.source,
        sandbox=result.sandbox,
        details=supplier_details_schema(result.details) if result.details else None,
        room_groups=[supplier_room_schema(room) for room in result.rooms],
    )
