from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.compare_hotels import CompareHotels
from hotel_agent.domain.errors import HotelNotFound, InvalidQuery

NOW = datetime(2026, 10, 26, tzinfo=UTC)


def record(hotel: str, source: str, value: float, key: str = "distance_to_sea") -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id=hotel,
        id=f"{hotel}-{source}-{key}",
        characteristic_key=key,
        value=value,
        unit="min",
        qualifiers={},
        source_type=source,
        source_id=None,
        method="test",
        confidence=0.9,
        computed_at=NOW,
        valid_until=None,
        status="active",
        geo_refs=(),
        explanation="Measured",
        facade_azimuth=None,
    )


def service(
    directory: Path, facts: list[SearchFactRecord], hotels: tuple[str, ...] = ("a", "b")
) -> tuple[CompareHotels, AsyncMock]:
    query = AsyncMock(return_value=facts)
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            search=SimpleNamespace(
                by_ids=AsyncMock(return_value=[SimpleNamespace(id=id) for id in hotels]),
                list_facts=query,
            )
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    return CompareHotels(
        cast(UnitOfWorkFactory, lambda: scope),
        YamlCharacteristicRegistry.from_directory(directory),
        cast(ClockPort, SimpleNamespace(now=lambda: NOW)),
    ), query


async def test_domain_ranking_beats_arrival_order_and_keeps_missing_cells(
    characteristics_dir: Path,
) -> None:
    compare, query = service(
        characteristics_dir,
        [
            record("a", "osm", 12),
            record("a", "computed", 9),
            record("a", "hotelier", 7),
            record("b", "osm", 4),
            replace(
                record("b", "computed", 2),
                computed_at=NOW - timedelta(days=2),
                valid_until=NOW - timedelta(days=1),
            ),
            record("a", "computed", 30, "noise_level"),
        ],
    )
    result = await compare(["b", "a", "b"])
    assert result.characteristic_keys == ("distance_to_sea", "noise_level")
    assert [row.hotel_id for row in result.rows] == ["b", "a"]
    assert result.rows[0].cells["distance_to_sea"].value == 4
    assert result.rows[1].cells["distance_to_sea"].value == 7
    assert "noise_level" not in result.rows[0].cells
    query.assert_awaited_once_with(None, hotel_ids=("b", "a"))


async def test_requested_union_preserves_order_and_excludes_unavailable_facts(
    characteristics_dir: Path,
) -> None:
    compare, _ = service(
        characteristics_dir,
        [
            replace(record("a", "osm", 9), status="superseded"),
            replace(record("b", "computed", 2), status="computing", value=None),
        ],
    )
    result = await compare(["a", "b"], ["noise_level", "distance_to_sea", "noise_level"])
    assert result.characteristic_keys == ("noise_level", "distance_to_sea")
    assert all(not row.cells for row in result.rows)


async def test_missing_hotel_does_not_silently_shrink_comparison(characteristics_dir: Path) -> None:
    compare, query = service(characteristics_dir, [], ("a",))
    with pytest.raises(HotelNotFound):
        await compare(["a", "unknown"])
    query.assert_not_awaited()


@pytest.mark.parametrize("ids", [["a"], ["a"] * 6])
async def test_invalid_selection_is_rejected(characteristics_dir: Path, ids: list[str]) -> None:
    compare, query = service(characteristics_dir, [])
    with pytest.raises(InvalidQuery):
        await compare(ids)
    query.assert_not_awaited()
