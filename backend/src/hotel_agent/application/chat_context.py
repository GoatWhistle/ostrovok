from dataclasses import asdict
from typing import Any

from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.domain.entities import FactStatus
from hotel_agent.domain.errors import HotelNotFound


async def selected_hotel_context(
    get_card: GetHotelCard | None, hotel_id: str | None
) -> dict[str, Any] | None:
    if not hotel_id:
        return None
    if get_card is None:
        return {"id": hotel_id, "unavailable": True}
    try:
        card = await get_card(hotel_id)
    except HotelNotFound:
        return {"id": hotel_id, "unavailable": True}
    return {
        "id": card.hotel.id,
        "name": card.hotel.name,
        "address": card.hotel.address,
        "location": card.hotel.location,
        "stars": card.hotel.stars,
        "rooms": [asdict(room) for room in card.rooms[:12]],
        "room_inventory_count": len(card.rooms),
        "availability_verified": False,
        "facts": [
            {
                "id": fact.id,
                "characteristic": fact.characteristic_key,
                "value": fact.value,
                "unit": fact.unit,
                "status": fact.status,
                "qualifiers": {
                    k: v
                    for k, v in fact.qualifiers.items()
                    if k
                    in {
                        "estimated_location",
                        "estimated_view",
                        "estimated_absence",
                        "from_floor",
                        "months",
                        "facade_azimuth",
                        "source_urls",
                        "synthetic",
                        "sandbox",
                    }
                },
                "explanation": fact.explanation[:600],
                "source": asdict(fact.provenance),
            }
            for fact in sorted(
                card.facts,
                key=lambda item: (
                    item.status is not FactStatus.CONFIRMED_BY_HOTELIER,
                    item.characteristic_key.startswith("derived:"),
                ),
            )[:24]
        ],
        "fact_count": len(card.facts),
        "supplier_content": asdict(card.supplier_content) if card.supplier_content else None,
        "note": "Stored inventory, not live room availability. Missing fields are unknown. Lists may be truncated; history is not a factual source.",
    }
