import asyncio
import os
from datetime import timedelta

import psycopg

from hotel_agent.adapters.db.derived_facts import save_derived_facts
from hotel_agent.application.dto import SearchFactRecord


async def main():
    connection = await psycopg.AsyncConnection.connect(os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel"))
    async with connection:
        cursor = await connection.execute("SELECT search_snapshot,updated_at FROM chat_conversations WHERE search_snapshot IS NOT NULL ORDER BY updated_at")
        existing = {row[0] for row in await (await connection.execute("SELECT id FROM facts")).fetchall()}
        records = {}
        for snapshot, at in await cursor.fetchall():
            for result in snapshot.get("results", []):
                hotel_id = result["hotel"]["id"]
                for match in result.get("matched", []):
                    fact = match.get("fact") or {}
                    key, fact_id = fact.get("characteristic_key", ""), fact.get("fact_id", "")
                    if not key.startswith(("nearby:", "spatial:", "facility:")) or not fact_id or fact_id in existing:
                        continue
                    records[fact_id] = SearchFactRecord(
                        hotel_id=hotel_id, id=fact_id, characteristic_key=key,
                        value=fact["value"], unit=fact.get("unit"),
                        qualifiers={"source_text": fact.get("label") or match.get("label", key), "restored_from_saved_search": True},
                        source_type=fact["source_type"], source_id=None,
                        method="saved_search_snapshot@1", confidence=fact["confidence"],
                        computed_at=at, valid_until=at+timedelta(days=30), status="active",
                        geo_refs=tuple(fact.get("geo_refs", [])), explanation=match.get("explanation", "Сохранённый результат поиска"), facade_azimuth=None,
                    )
        await save_derived_facts(connection, list(records.values()))
        await connection.commit()
        print({"restored_missing_dynamic_facts": len(records)})


asyncio.run(main())
