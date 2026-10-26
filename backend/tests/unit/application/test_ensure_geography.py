import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.dto import SeedLayers
from hotel_agent.application.ports.geography import GeographySnapshot
from hotel_agent.application.ports.view_geometry import PhysicalArea
from hotel_agent.application.use_cases.ensure_geography import EnsureGeography

NOW = datetime(2026, 10, 26, tzinfo=UTC)
BBOX = (10.0, 50.0, 10.005, 50.005)
AREA = PhysicalArea(BBOX, (), True, "https://example.test/api")
SNAPSHOT = GeographySnapshot(BBOX, SeedLayers(), AREA.source_url, NOW, True)


def context() -> tuple[EnsureGeography, SimpleNamespace, SimpleNamespace, MagicMock]:
    repo = SimpleNamespace(cached=AsyncMock(return_value=None), save=AsyncMock())
    uow = MagicMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=None)
    uow.geography = repo
    uow.commit = AsyncMock()
    source = SimpleNamespace(fetch=AsyncMock(return_value=SNAPSHOT))
    clock = SimpleNamespace(now=lambda: NOW)
    return EnsureGeography(lambda: uow, source, clock, MagicMock()), repo, source, uow


async def test_local_coverage_including_empty_areas_never_calls_the_network() -> None:
    usecase, repo, source, _ = context()
    repo.cached.return_value = AREA
    assert await usecase.area(BBOX) == AREA
    source.fetch.assert_not_awaited()
    repo.save.assert_not_awaited()


async def test_download_is_committed_before_becoming_reusable_local_data() -> None:
    usecase, repo, source, uow = context()
    repo.cached.side_effect = [None, AREA]
    assert await usecase.area(BBOX, "test-region") == AREA
    repo.save.assert_awaited_once_with(SNAPSHOT, "test-region")
    uow.commit.assert_awaited_once()
    source.fetch.assert_awaited_once_with(BBOX)


async def test_concurrent_readers_share_one_download_and_commit() -> None:
    usecase, repo, source, uow = context()
    saved = False

    async def cached(*_: object) -> PhysicalArea | None:
        return AREA if saved else None

    async def commit() -> None:
        nonlocal saved
        saved = True

    async def fetch(*_: object) -> GeographySnapshot:
        await asyncio.sleep(0)
        return SNAPSHOT

    repo.cached.side_effect = cached
    source.fetch.side_effect = fetch
    uow.commit.side_effect = commit
    assert await asyncio.gather(*(usecase.area(BBOX) for _ in range(8))) == [AREA] * 8
    source.fetch.assert_awaited_once()
    uow.commit.assert_awaited_once()


async def test_failure_is_not_saved_as_empty_coverage_and_has_a_retry_pause() -> None:
    usecase, repo, source, uow = context()
    source.fetch.return_value = None
    assert await usecase.area(BBOX) is None
    assert await usecase.area(BBOX) is None
    source.fetch.assert_awaited_once()
    repo.save.assert_not_awaited()
    uow.commit.assert_not_awaited()


@pytest.mark.parametrize("bbox", [(0, 0, 180, 85), (10, 51, 10, 52), (0, float("nan"), 0.1, 1)])
async def test_unbounded_or_invalid_requests_fail_before_storage_or_network(
    bbox: tuple[float, float, float, float],
) -> None:
    usecase, repo, source, _ = context()
    with pytest.raises(ValueError):
        await usecase.area(bbox)
    source.fetch.assert_not_awaited()
    repo.cached.assert_not_awaited()
