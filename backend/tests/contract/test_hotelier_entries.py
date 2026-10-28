from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.application.use_cases.hotelier_entries import ManageHotelierEntries
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.interfaces.http.routers.hotelier_entries import build_router
from tests.unit.application.hotelier_fakes import FixedClock


def test_entry_http_contract_and_validation(validate: Any) -> None:
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.facts.lock_hotel = AsyncMock(return_value=True)
    uow.search.get_hotel = AsyncMock(return_value=object())
    uow.hotelier_entries.save = AsyncMock()
    uow.hotelier_entries.for_hotel = AsyncMock(return_value=[])
    uow.commit = AsyncMock()
    app = FastAPI()
    ErrorHandlers(StdlibLogger("entry-test")).register(app)
    app.include_router(build_router(ManageHotelierEntries(lambda: uow, FixedClock())))
    with TestClient(app) as client:
        path = f"/hotelier/h1/entries/{uuid4()}"
        saved = client.put(path, json={"title": "Arrival", "description": "After 10am"})
        assert saved.status_code == 200
        validate("HotelierEntry", saved.json())
        assert client.get("/hotelier/h1/entries").json() == {"items": []}
        for payload in [
            {"title": " ", "description": "x"},
            {"title": "x", "description": " "},
            {"title": "x", "description": "y", "extra": True},
        ]:
            invalid = client.put(path, json=payload)
            assert invalid.status_code == 422
            validate("Error", invalid.json())
        assert (
            client.put(
                "/hotelier/h1/entries/invalid", json={"title": "x", "description": "y"}
            ).status_code
            == 422
        )
