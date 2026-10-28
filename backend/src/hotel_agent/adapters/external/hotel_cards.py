from hotel_agent.application.ports.hotel_web_card import HotelCardLookupPort
from hotel_agent.application.ports.supplier_details import SupplierHotel
from hotel_agent.domain.hotel_identity import HotelIdentity


class FirstHotelCard:
    def __init__(self, *lookups: HotelCardLookupPort) -> None:
        self._lookups = lookups

    async def find(self, hotel: HotelIdentity) -> SupplierHotel | None:
        fallback: SupplierHotel | None = None
        for lookup in self._lookups:
            found = await lookup.find(hotel)
            if found is None:
                continue
            if found.rooms:
                return found
            fallback = fallback or found
        return fallback
