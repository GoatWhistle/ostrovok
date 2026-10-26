from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.places import PlaceRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.get_place import GetPlace
from hotel_agent.domain.errors import HotelNotFound, PlaceNotFound
from hotel_agent.domain.value_objects import SubjectKind

NOW = datetime(2026, 10, 26, tzinfo=UTC)


def service(place: PlaceRecord | None, hotel: object = True) -> tuple[GetPlace, AsyncMock]:
    walks = AsyncMock(return_value=[])
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            places=SimpleNamespace(get=AsyncMock(return_value=place)),
            search=SimpleNamespace(get_hotel=AsyncMock(return_value=hotel)),
            walk=SimpleNamespace(routes=walks),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    return GetPlace(
        cast(UnitOfWorkFactory, lambda: scope), cast(ClockPort, SimpleNamespace(now=lambda: NOW))
    ), walks


async def test_place_facts_keep_source_tags_and_snapshot_age() -> None:
    get, walks = service(
        PlaceRecord(
            id="w123",
            location=(39.9, 43.4),
            tags={"amenity": "bar", "name": "", "opening_hours": "24/7", "private_note": "secret"},
            extracted_at=NOW - timedelta(days=400),
        )
    )
    card = await get("w123")
    assert card.name is None
    assert card.kind == "bar"
    assert card.tags == {"amenity": "bar", "opening_hours": "24/7"}
    assert card.osm_ref == "way/123"
    assert card.source_url == "https://www.openstreetmap.org/way/123"
    assert all(fact.subject.kind == SubjectKind.PLACE for fact in card.facts)
    assert all(fact.status.value == "stale" for fact in card.facts)
    assert all(fact.provenance.confidence.value == 0.7 for fact in card.facts)
    assert card.walk is None
    walks.assert_not_awaited()


async def test_unknown_place_or_hotel_is_not_silently_ignored() -> None:
    get, walks = service(None)
    with pytest.raises(PlaceNotFound):
        await get("n1")
    walks.assert_not_awaited()
    get, walks = service(
        PlaceRecord(id="n1", location=(39.9, 43.4), tags={}, extracted_at=NOW), None
    )
    with pytest.raises(HotelNotFound):
        await get("n1", "missing")
    walks.assert_not_awaited()
