import asyncio
import json
import os
from pathlib import Path

import psycopg
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.precompute import PostgresPrecompute
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.use_cases.hotelier_questions import PlanHotelierQuestions
from hotel_agent.application.use_cases.precompute import Precompute

REGION = "hotelier_demo_20261027"
HOTEL = "h_demo_typed_check"
NAME = "ДЕМО: Проверка форм отельера (тестовые данные)"


async def main() -> None:
    url = os.environ["DATABASE_URL"]
    async with await psycopg.AsyncConnection.connect(url) as connection:
        region = await connection.execute("SELECT 1 FROM regions WHERE id = %(id)s", {"id": REGION})
        if await region.fetchone() is None:
            raise RuntimeError("Demo region is missing")
        await connection.execute(
            """INSERT INTO buildings(id, region_id, footprint, tags)
            VALUES (%(building)s, %(region)s,
                ST_Multi(ST_MakeEnvelope(39.7309, 43.6009, 39.7311, 43.6011, 4326)),
                '{"building":"hotel","height":"9","building:levels":"3","synthetic":"yes"}')
            ON CONFLICT (id) DO NOTHING""",
            {"building": f"b_{HOTEL}", "region": REGION},
        )
        await connection.execute(
            """INSERT INTO hotels(id, region_id, name, location, building_id)
            VALUES (%(hotel)s, %(region)s, %(name)s,
                ST_SetSRID(ST_MakePoint(39.731, 43.601), 4326), %(building)s)
            ON CONFLICT (id) DO NOTHING""",
            {"hotel": HOTEL, "region": REGION, "name": NAME, "building": f"b_{HOTEL}"},
        )
        await connection.execute(
            """DELETE FROM conflicts WHERE subject_type = 'hotel' AND subject_id = %(hotel)s""",
            {"hotel": HOTEL},
        )
        await connection.execute(
            """DELETE FROM facts WHERE subject_type = 'hotel' AND subject_id = %(hotel)s""",
            {"hotel": HOTEL},
        )
        await connection.execute(
            "DELETE FROM hotelier_questions WHERE hotel_id = %(hotel)s", {"hotel": HOTEL}
        )
    async with AsyncConnectionPool(url, min_size=1, max_size=1, open=False) as pool:
        computed = await Precompute(PostgresPrecompute(pool))(REGION)
    uow = PostgresUnitOfWorkFactory(url)
    registry = YamlCharacteristicRegistry.from_directory(Path(os.environ["CHARACTERISTICS_DIR"]))
    try:
        added = await PlanHotelierQuestions(uow, registry, SystemClock())(REGION)
        async with uow() as unit:
            questions = await unit.questions.for_hotel(HOTEL)
    finally:
        await uow.aclose()
    print(
        json.dumps(
            {
                "hotel": HOTEL,
                "computed": dict(computed),
                "added_questions": added,
                "questions": {item.id: item.status for item in questions},
            },
            ensure_ascii=False,
            indent=2,
        )
    )


asyncio.run(main())
