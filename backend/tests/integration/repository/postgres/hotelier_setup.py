from pathlib import Path
from uuid import uuid4

import psycopg
from psycopg_pool import AsyncConnectionPool

from hotel_agent.adapters.clock.system import SystemClock
from hotel_agent.adapters.db.precompute import PostgresPrecompute
from hotel_agent.adapters.db.uow import PostgresUnitOfWorkFactory
from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.change_facts import ChangeFacts

REGISTRY = YamlCharacteristicRegistry.from_directory(
    Path(__file__).resolve().parents[5] / "characteristics"
)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


async def seed_hotel(url: str, double_rooms: bool = True) -> tuple[str, str]:
    tag = uuid4().hex[:10]
    region, hotel, building = f"it_{tag}", f"h_{tag}", f"b_{tag}"
    async with await psycopg.AsyncConnection.connect(url) as connection:
        await connection.execute(
            """INSERT INTO regions(id, name, bbox, built_at)
            VALUES (%(region)s, 'Integration', ST_MakeEnvelope(39, 43, 40, 44, 4326), now())""",
            {"region": region},
        )
        await connection.execute(
            """INSERT INTO buildings(id, region_id, footprint, tags)
            VALUES (%(building)s, %(region)s,
                ST_Multi(ST_MakeEnvelope(39.5, 43.5, 39.5001, 43.5001, 4326)),
                '{"building":"hotel","building:levels":"5"}')""",
            {"building": building, "region": region},
        )
        await connection.execute(
            """INSERT INTO hotels(id, region_id, name, location, building_id)
            VALUES (%(hotel)s, %(region)s, 'Integration hotel',
                ST_SetSRID(ST_MakePoint(39.50005, 43.50005), 4326), %(building)s)""",
            {"hotel": hotel, "region": region, "building": building},
        )
        await connection.execute(
            """INSERT INTO rooms(id, hotel_id, name, capacity, synthetic)
            VALUES (%(room)s, %(hotel)s, 'Standard', %(capacity)s, false)""",
            {"room": f"r_{tag}", "hotel": hotel, "capacity": 2 if double_rooms else 3},
        )
    return region, hotel


async def precompute(url: str, region: str) -> None:
    async with AsyncConnectionPool(url, min_size=1, max_size=1, open=False) as pool:
        await PostgresPrecompute(pool).run(region)


async def fact_rows(url: str, hotel_id: str, key: str) -> list[tuple[str, object, str]]:
    async with await psycopg.AsyncConnection.connect(url) as connection:
        cursor = await connection.execute(
            """SELECT id, value, status FROM facts
            WHERE subject_type = 'hotel' AND subject_id = %(hotel)s
              AND characteristic_key = %(key)s ORDER BY computed_at, id""",
            {"hotel": hotel_id, "key": key},
        )
        return [(str(row[0]), row[1], str(row[2])) for row in await cursor.fetchall()]


def services(
    url: str, llm: LLMPort | None = None
) -> tuple[PostgresUnitOfWorkFactory, AnswerHotelierQuestion, ChangeFacts]:
    uow = PostgresUnitOfWorkFactory(url)
    answer = AnswerHotelierQuestion(uow, REGISTRY, llm or FakeLLM(REGISTRY), SystemClock(), new_id)
    return uow, answer, ChangeFacts(uow, REGISTRY, SystemClock(), new_id)
