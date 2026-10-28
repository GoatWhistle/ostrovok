from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.dto import ConflictRecord, NotificationRecord, SearchFactRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.use_cases.precompute_sunset import KEY, PrecomputeSunset
from hotel_agent.application.use_cases.refresh_facts import RefreshStaleFacts
from tests.unit.application.test_precompute_sunset import facade, hotel

NOW = datetime(2026, 10, 27, tzinfo=UTC)


def stored(value: bool) -> SearchFactRecord:
    return SearchFactRecord(
        hotel_id="h1",
        id=f"f_{KEY}_h1",
        characteristic_key=KEY,
        value=value,
        unit=None,
        qualifiers={"months": "апрель — август"},
        source_type="computed",
        source_id=None,
        method="sunset_view@1",
        confidence=0.75,
        computed_at=NOW - timedelta(days=400),
        valid_until=NOW - timedelta(days=35),
        status="active",
        geo_refs=(),
        explanation="",
        facade_azimuth=None,
        subject_id="h1",
    )


def _collect(sink: list[NotificationRecord]) -> Callable[[Sequence[NotificationRecord]], int]:
    def collect(rows: Sequence[NotificationRecord]) -> int:
        sink.extend(rows)
        return len(rows)

    return collect


def build(
    stale: list[SearchFactRecord], skyline: float, registry: CharacteristicRegistryPort
) -> tuple[
    RefreshStaleFacts,
    list[SearchFactRecord],
    list[ConflictRecord],
    list[NotificationRecord],
]:
    saved: list[SearchFactRecord] = []
    conflicts: list[ConflictRecord] = []
    notices: list[NotificationRecord] = []
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(
        return_value=SimpleNamespace(
            search=SimpleNamespace(
                stale_facts=AsyncMock(return_value=stale),
                by_ids=AsyncMock(return_value=[hotel(9)]),
                list_facades=AsyncMock(return_value=[facade(290.0)]),
                list_rooms=AsyncMock(return_value=[]),
                list_hotels=AsyncMock(return_value=[hotel(9)]),
            ),
            facts=SimpleNamespace(
                retire_expired=AsyncMock(return_value=3),
                save=AsyncMock(side_effect=lambda rows: saved.extend(rows)),
                versions=AsyncMock(return_value=list(stale)),
                save_conflicts=AsyncMock(side_effect=lambda rows: conflicts.extend(rows)),
            ),
            notifications=SimpleNamespace(add=AsyncMock(side_effect=_collect(notices))),
            commit=AsyncMock(),
        )
    )
    scope.__aexit__ = AsyncMock(return_value=None)
    factory = cast(UnitOfWorkFactory, lambda: scope)
    clock = cast(ClockPort, SimpleNamespace(now=lambda: NOW))
    views = cast(
        ViewAssessmentPort,
        SimpleNamespace(
            assess=AsyncMock(
                return_value={"h1": {"ground_elevation_m": 12.0, "skyline_elevation_m": skyline}}
            )
        ),
    )
    return (
        RefreshStaleFacts(factory, PrecomputeSunset(factory, views, clock), registry, clock),
        (saved),
        conflicts,
        notices,
    )


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


async def test_an_unchanged_fact_is_only_given_a_new_validity(
    registry: YamlCharacteristicRegistry,
) -> None:
    refresh, saved, conflicts, notices = build([stored(True)], 14.0, registry)

    report = await refresh("sochi")

    assert (report.checked, report.recomputed, report.changed) == (1, 1, 0)
    assert conflicts == []
    assert notices == []
    assert saved[0].valid_until is not None and saved[0].valid_until > NOW


async def test_a_view_closed_since_the_last_check_is_recorded_as_a_conflict(
    registry: YamlCharacteristicRegistry,
) -> None:
    refresh, _, conflicts, _ = build([stored(True)], 70.0, registry)

    report = await refresh("sochi")

    assert (report.changed, report.conflicts) == (1, 1)
    assert conflicts[0].characteristic_key == KEY
    assert conflicts[0].rule


async def test_a_closed_view_reaches_the_hotelier_as_a_notification(
    registry: YamlCharacteristicRegistry,
) -> None:
    refresh, _, _, notices = build([stored(True)], 70.0, registry)

    await refresh("sochi")

    changed = next(item for item in notices if item.kind == "fact_changed")
    assert changed.hotel_id == "h1"
    assert changed.characteristic_key == KEY
    assert changed.payload["previous"] is True
    assert changed.payload["current"] is False
    assert changed.severity == "info"
    settled = next(item for item in notices if item.kind == "conflict_resolved")
    assert settled.payload["resolution"] == "resolved_by_rule"
    assert settled.payload["rule"]


async def test_expired_facts_lose_their_active_status_first(
    registry: YamlCharacteristicRegistry,
) -> None:
    refresh, _, _, _ = build([], 14.0, registry)

    report = await refresh("sochi")

    assert report.retired == 3
