import asyncio, json, sys
from pathlib import Path
from hotel_agent.adapters.external.hotel_web_card import WebHotelCard
from hotel_agent.adapters.external.web_research import PublicWebResearch
from hotel_agent.domain.hotel_identity import HotelIdentity

CASES = [
    ("Гостиница Кедр", "Парковая улица 4", "Абаза", (90.1035, 52.6469)),
    ("Прикумск", "улица Борцов Революции 168", "Будённовск", (44.1573, 44.7836)),
    ("Союз", "Шереметевский проспект 47", "Иваново", (40.986897, 57.0033662)),
    ("Виноград", "Лименская улица 5", "Кацивели", (33.976562, 44.3977871)),
    ("Отель на Еловом", "", "Миасс", (60.3111, 55.0060)),
]

async def main():
    web = PublicWebResearch()
    card = WebHotelCard(web)
    out = []
    for name, addr, city, loc in CASES:
        hotel = HotelIdentity(name=name, address=addr or None, city=city, location=loc)
        try:
            found = await card.find(hotel)
        except Exception as exc:
            record = {"name": name, "error": f"{type(exc).__name__}: {exc}"}
        else:
            record = {"name": name, "found": None if found is None else {
                "source": found.details.supplier_id,
                "url": found.details.page_url,
                "card_name": found.details.name,
                "address": found.details.address,
                "rooms": found.details.facts.rooms_number,
                "stars": found.details.facts.star_rating,
                "amenities": [a.name for g in found.details.amenity_groups for a in g.amenities][:8],
                "photos": len(found.details.photos),
            }}
        out.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        await asyncio.sleep(2.0)
    await web.aclose()
    Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False, indent=2))

asyncio.run(main())
