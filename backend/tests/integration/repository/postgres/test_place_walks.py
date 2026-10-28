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


async def test_same_building_does_not_invent_an_outdoor_walk() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        router = PostgresWalkRouter(connection, WalkRouteCache())
        same = await router.routes("w114131768", ("n7023837485",), 500)
        assert len(same) == 1
        assert same[0].mode == "onsite"
        assert same[0].minutes is None
        assert same[0].geometry["type"] == "Point"
        close = await router.routes("n11497670982", ("n10583800764",), 500)
        assert len(close) == 1
        assert close[0].mode == "graph"
        assert 0 < close[0].meters < 40
    finally:
        await connection.rollback()
        await connection.close()


async def test_walk_to_resolved_waterfront_endpoint() -> None:
    connection = await psycopg.AsyncConnection.connect(
        os.environ.get("DATABASE_URL", "postgresql://hotel:hotel@localhost:5432/hotel")
    )
    try:
        router = PostgresWalkRouter(connection, WalkRouteCache())
        point = (39.6484437, 43.6522617)
        routes = await router.to_points("n4331507393", {"waterfront": point}, 500)
        assert len(routes) == 1
        assert routes[0].mode == "graph"
        assert routes[0].meters > 112
        coordinates = routes[0].geometry["coordinates"]
        assert isinstance(coordinates, list)
        assert coordinates[-1] == point
    finally:
        await connection.rollback()
        await connection.close()
