import asyncio
from collections.abc import Mapping, Sequence
from typing import Self

import pytest

from hotel_agent.application.dto import Feature, SeedLayers
from hotel_agent.application.use_cases.ingest_polygons import IngestPolygons


class Storage:
    def __init__(self, fail: bool = False) -> None:
        self.active = 0
        self.maximum = 0
        self.committed: list[str] = []
        self.linked = False
        self.fail = fail


class Writer:
    def __init__(self, storage: Storage) -> None:
        self.storage = storage
        self.pending: list[str] = []

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        self.pending.clear()

    async def upsert_region(self, region: str, meta: Mapping[str, object]) -> None: ...

    async def save_layer(self, region: str, name: str, features: Sequence[Feature]) -> int:
        self.storage.active += 1
        self.storage.maximum = max(self.storage.maximum, self.storage.active)
        try:
            await asyncio.sleep(0)
            if self.storage.fail:
                raise RuntimeError("storage unavailable")
            self.pending.extend(item.id for item in features)
            return len(features)
        finally:
            self.storage.active -= 1

    async def commit(self) -> None:
        self.storage.committed.extend(self.pending)
        self.pending.clear()

    async def link_hotels(self, region: str) -> int:
        self.storage.linked = True
        return 0


def batches() -> list[SeedLayers]:
    return [
        SeedLayers(buildings=[Feature(id=str(i), geometry={}, properties={})]) for i in range(8)
    ]


async def test_workers_write_in_isolated_transactions_and_count_committed_records_once() -> None:
    storage = Storage()
    observations: list[dict[str, int]] = []
    report = await IngestPolygons(lambda: Writer(storage), workers=2)(
        "test",
        {},
        batches(),
        frozenset({"buildings", "beaches"}),
        lambda: None,
        lambda number, counts: observations.append(dict(counts)),
    )
    assert storage.maximum == 2
    assert sorted(storage.committed) == [str(i) for i in range(8)]
    assert storage.linked
    assert report.counts == {"buildings": 8, "beaches": 0}
    assert [row["buildings"] for row in observations] == list(range(1, 9))


async def test_failed_worker_cancels_import_without_claiming_complete_or_linking_hotels() -> None:
    storage = Storage(fail=True)
    with pytest.raises(ExceptionGroup):
        await IngestPolygons(lambda: Writer(storage), workers=2)(
            "test",
            {},
            batches(),
            frozenset({"buildings"}),
            lambda: None,
            lambda *_: None,
        )
    assert not storage.linked
    assert not storage.committed
