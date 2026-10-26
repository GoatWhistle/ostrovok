import os
from time import perf_counter

import psycopg

from hotel_agent.adapters.db.walk_router import PostgresWalkRouter, WalkRouteCache
from hotel_agent.application.walk_refs import walk_feature


async def test_sochi_bar_routes_are_bounded_cached_and_use_real_edges() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        router = PostgresWalkRouter(connection, WalkRouteCache())
        started = perf_counter()
        routes = await router.routes("n4712092442", ("w713692556", "w713972246"), 500)
        elapsed = perf_counter() - started
        assert len(routes) == 2, "Load the Sochi seed before checking nearby walks"
        assert elapsed < 1, f"Two routes took {elapsed:.3f}s"
        assert any(route.mode == "graph" for route in routes)
        for route in routes:
            feature = walk_feature(route)
            assert feature.kind == "route"
            assert feature.geometry["type"] == "LineString"
            if route.mode == "graph":
                assert route.minutes == round(route.meters / 80, 1)
            else:
                assert route.minutes is None
        repeated = await router.routes("n4712092442", ("w713692556", "w713972246"), 500)
        assert repeated == routes
        assert await router.routes("missing", ("w713692556",), 500) == []
    finally:
        await connection.rollback()
        await connection.close()
