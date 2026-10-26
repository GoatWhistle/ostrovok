from datetime import UTC, datetime
from typing import Any, cast
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.application.ports.places import PlaceRecord
from hotel_agent.application.use_cases.get_place import GetPlace, PlaceCard
from hotel_agent.interfaces.http.routers.places import build_router


def test_place_card_matches_published_contract(validate: Any) -> None:
    card = PlaceCard(
        place=PlaceRecord(
            id="n1", location=(39.9, 43.4), tags={}, extracted_at=datetime(2026, 10, 25, tzinfo=UTC)
        ),
        name=None,
        kind="place",
        osm_ref="node/1",
        source_url="https://www.openstreetmap.org/node/1",
        tags={},
        facts=(),
        walk=None,
    )
    app = FastAPI()
    app.include_router(build_router(cast(GetPlace, AsyncMock(return_value=card))))
    with TestClient(app) as client:
        response = client.get("/places/n1")
    assert response.status_code == 200
    validate("PlaceCard", response.json())
