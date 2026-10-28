import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import psycopg

from hotel_agent.adapters.external.event_sources import PublicEvents
from hotel_agent.adapters.external.web_research import PublicWebResearch
from hotel_agent.application.ports.place_research import PlaceResearchRequest


async def main():
    web = PublicWebResearch()
    events = PublicEvents(web)
    try:
        result = await events.research(PlaceResearchRequest(
            (37.617, 55.755), 20000,
            start=datetime(2026, 11, 21, 21, tzinfo=UTC),
            end=datetime(2026, 11, 22, 21, tzinfo=UTC),
            url='https://afisha.yandex.ru/moscow/concert/kishlak-2026-11',
        ))
        assert result.records, 'Public event must expose a dated venue'
        event = result.records[0]
        lon, lat = event['location']
        with psycopg.connect('postgresql://hotel:hotel@localhost:5432/hotel') as connection:
            rows = connection.execute('''SELECT name, round(ST_Distance(location::geography,
                ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)) FROM hotels
                WHERE ST_DWithin(location::geography,
                ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,2000)
                ORDER BY 2 LIMIT 8''', (lon, lat, lon, lat)).fetchall()
        assert rows, 'Stored hotels must exist within 2 km of the sourced venue'
        output = {'event': event, 'nearby_hotels': rows,
                  'scope': 'Live free source and read-only database; no LLM or room availability check'}
        Path('../work/event-search/live-probe.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
        print(event['title'], event['place'], len(rows), 'nearby hotels')
    finally:
        await events.aclose()
        await web.aclose()


asyncio.run(main())
