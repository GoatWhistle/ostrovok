import asyncio
from collections.abc import Callable, Iterable, Mapping
from contextlib import AbstractAsyncContextManager

from hotel_agent.application.dto import SeedLayers
from hotel_agent.application.ports.ingest import SeedWriterPort
from hotel_agent.application.use_cases.ingest_pbf import PbfIngestReport


class IngestPolygons:
    def __init__(
        self, writers: Callable[[], AbstractAsyncContextManager[SeedWriterPort]], workers: int = 2
    ) -> None:
        if not 1 <= workers <= 4:
            raise ValueError("Polygon import workers must be between one and four")
        self._writers, self._workers = writers, workers

    async def __call__(
        self,
        region: str,
        meta: Mapping[str, object],
        batches: Iterable[SeedLayers],
        selected_layers: frozenset[str],
        check_capacity: Callable[[], None],
        on_batch: Callable[[int, Mapping[str, int]], None],
    ) -> PbfIngestReport:
        if not selected_layers or selected_layers - {"buildings", "beaches"}:
            raise ValueError("Parallel polygon import supports only buildings and beaches")
        async with self._writers() as writer:
            await writer.upsert_region(region, meta)
            await writer.commit()
        queue: asyncio.Queue[SeedLayers | None] = asyncio.Queue(maxsize=self._workers)
        counts = {name: 0 for name in selected_layers}
        batch_count = 0

        async def consume() -> None:
            nonlocal batch_count
            async with self._writers() as writer:
                while (batch := await queue.get()) is not None:
                    written = {}
                    for name in selected_layers:
                        features = getattr(batch, name)
                        if features:
                            written[name] = await writer.save_layer(region, name, features)
                    await writer.commit()
                    for name, count in written.items():
                        counts[name] += count
                    batch_count += 1
                    on_batch(batch_count, dict(counts))

        async with asyncio.TaskGroup() as tasks:
            for _ in range(self._workers):
                tasks.create_task(consume())
            for batch in batches:
                check_capacity()
                await queue.put(batch)
            for _ in range(self._workers):
                await queue.put(None)
        if counts.get("buildings"):
            async with self._writers() as writer:
                await writer.link_hotels(region)
                await writer.commit()
        return PbfIngestReport(region, batch_count, counts)
