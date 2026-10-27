import asyncio, json, sys
from pathlib import Path
import httpx
from hotel_agent.adapters.external.ostrovok_lookup import OstrovokLookup, search_queries, rank_suggestions
from hotel_agent.adapters.external.ostrovok_catalog import OstrovokCatalog
from hotel_agent.domain.hotel_identity import HotelIdentity, HotelCandidate, assess_identity

HEADERS = {"Accept-Language": "ru-RU,ru;q=0.9",
           "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

async def main():
    rows = [line.split("|") for line in Path(sys.argv[1]).read_text().splitlines() if line]
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=30) as client:
        lookup = OstrovokLookup(client)
        catalog = OstrovokCatalog(client)
        for hid, name, addr, city, lon, lat in rows:
            hotel = HotelIdentity(name=name, address=addr or None, city=city or None,
                                  location=(float(lon), float(lat)))
            queries = search_queries(hotel)
            found = {}
            for q in queries:
                try:
                    for s in await catalog.suggest(q):
                        found.setdefault(s.master_id, s)
                except Exception as exc:
                    print(hid, "suggest_error", q, type(exc).__name__)
                await asyncio.sleep(0.8)
            ranked = rank_suggestions(hotel, tuple(found.values()))
            print(f"\n=== {hid} {name!r} addr={addr!r} city={city!r}")
            print("  queries:", queries, "| suggestions:", len(found), "| ranked:", len(ranked))
            for s in ranked:
                print(f"   cand {s.name!r} / {s.address!r} / {s.city!r}")
            verified = await lookup._verify(hotel, ranked)
            for s in ranked:
                try:
                    resolved = await lookup._read(s)
                except Exception as exc:
                    print("   read_error", s.name, type(exc).__name__); continue
                loc = resolved.details.location
                if loc is None:
                    print("   no_location", resolved.details.name); continue
                a = assess_identity(hotel, HotelCandidate(supplier_id=str(s.master_id),
                        identity=HotelIdentity(name=resolved.details.name,
                            address=resolved.details.address, location=loc,
                            city=resolved.details.city)))
                print(f"   assess {resolved.details.name!r} dist={a.distance_m:.0f}m sim={a.name_similarity:.2f} addr={a.address_status} -> {a.reason}")
                await asyncio.sleep(0.8)
            print("  accepted:", len(verified))

asyncio.run(main())
