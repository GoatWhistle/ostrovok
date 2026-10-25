from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from hotel_agent.application.ports.ingest import SeedReaderPort, SeedWriterPort
from hotel_agent.domain.errors import InvalidValue

LAYERS = ("buildings", "hotels", "pois", "coastline", "beaches", "noise_sources", "walk")


@dataclass(frozen=True, slots=True)
class IngestReport:
    region: str
    counts: Mapping[str, int]
    hotels_with_footprint: int


class IngestSeed:
    def __init__(self, reader: SeedReaderPort, writer: SeedWriterPort) -> None:
        self._reader = reader
        self._writer = writer

    async def __call__(self, region: str, directory: Path) -> IngestReport:
        meta = self._reader.read_meta(directory)
        if meta.get("region") != region:
            raise InvalidValue(f"Seed region {meta.get('region')!r} does not match {region!r}")
        await self._writer.upsert_region(region, meta)
        counts: dict[str, int] = {}
        for name in LAYERS:
            features = self._reader.read_layer(directory, name)
            counts[name] = await self._writer.save_layer(region, name, features)
        linked = await self._writer.link_hotels(region)
        await self._writer.commit()
        return IngestReport(region=region, counts=counts, hotels_with_footprint=linked)
