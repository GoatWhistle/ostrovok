from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass

from hotel_agent.application.dto import SeedLayers
from hotel_agent.application.ports.ingest import SeedWriterPort


@dataclass(frozen=True, slots=True)
class PbfIngestReport:
    region: str
    batches: int
    counts: Mapping[str, int]


class IngestPbf:
    def __init__(self, writer: SeedWriterPort) -> None:
        self._writer = writer

    async def __call__(
        self,
        region: str,
        meta: Mapping[str, object],
        batches: Iterable[SeedLayers],
        selected_layers: frozenset[str],
        check_capacity: Callable[[], None],
        on_batch: Callable[[int, Mapping[str, int]], None],
    ) -> PbfIngestReport:
        await self._writer.upsert_region(region, meta)
        await self._writer.commit()
        counts = {name: 0 for name in selected_layers}
        batch_count = 0
        for batch in batches:
            check_capacity()
            for name in selected_layers:
                features = getattr(batch, name)
                if features:
                    counts[name] += await self._writer.save_layer(region, name, features)
            await self._writer.commit()
            batch_count += 1
            on_batch(batch_count, counts)
        if "buildings" in selected_layers and counts["buildings"]:
            await self._writer.link_hotels(region)
            await self._writer.commit()
        return PbfIngestReport(region=region, batches=batch_count, counts=counts)
