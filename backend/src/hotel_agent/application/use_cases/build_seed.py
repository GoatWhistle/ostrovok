from dataclasses import dataclass
from datetime import datetime

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.seed import (
    ElevationSourcePort,
    RegionSourcePort,
    SeedStorePort,
)
from hotel_agent.domain.value_objects import BBox


@dataclass(frozen=True, slots=True, kw_only=True)
class SeedReport:
    region: str
    bbox: BBox
    counts: dict[str, int]
    sizes: dict[str, int]
    elevation: dict[str, object]
    built_at: datetime

    @property
    def total_bytes(self) -> int:
        return sum(self.sizes.values())


class BuildSeed:
    def __init__(
        self,
        *,
        source: RegionSourcePort,
        store: SeedStorePort,
        elevation: ElevationSourcePort,
        clock: ClockPort,
        logger: LoggerPort,
    ) -> None:
        self._source = source
        self._store = store
        self._elevation = elevation
        self._clock = clock
        self._logger = logger

    def __call__(self, region: str, bbox: BBox) -> SeedReport:
        self._logger.info("seed_read_started", region=region, source=self._source.description)
        layers = self._source.read(bbox)
        counts = layers.counts()
        self._logger.info("seed_read_finished", region=region, **counts)

        sizes = {
            name: self._store.save_layer(name, getattr(layers, name)) for name in layers.names()
        }
        elevation = dict(self._elevation.crop(bbox))
        report = SeedReport(
            region=region,
            bbox=bbox,
            counts=counts,
            sizes=sizes,
            elevation=elevation,
            built_at=self._clock.now(),
        )
        self._store.save_meta(
            {
                "region": region,
                "bbox": list(bbox.as_tuple()),
                "built_at": report.built_at.isoformat(),
                "osm_source": self._source.description,
                "dem_source": self._elevation.description,
                "counts": counts,
                "bytes": sizes,
                "elevation": elevation,
            }
        )
        self._logger.info("seed_written", region=region, bytes=report.total_bytes)
        return report
