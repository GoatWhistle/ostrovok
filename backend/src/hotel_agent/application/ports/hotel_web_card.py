from typing import Protocol

from hotel_agent.application.ports.supplier_details import SupplierHotel
from hotel_agent.domain.hotel_identity import HotelIdentity


class HotelCardLookupPort(Protocol):
    async def find(self, hotel: HotelIdentity) -> SupplierHotel | None: ...
