from collections.abc import Mapping, Sequence
from datetime import UTC, datetime

from hotel_agent.application.dto import Feature, SeedLayers
from hotel_agent.application.ports.log import LogValue
from hotel_agent.application.use_cases.build_seed import BuildSeed
from hotel_agent.domain.value_objects import BBox

BBOX = BBox(39.55, 43.35, 40.00, 43.75)
NOW = datetime(2026, 10, 25, 9, 0, tzinfo=UTC)
HOTEL = Feature(id="n1", geometry={"type": "Point", "coordinates": [39.7, 43.6]}, properties={})


class FakeSource:
    description = "osm:sample.pbf"

    def __init__(self, layers: SeedLayers) -> None:
        self._layers = layers
        self.asked: list[BBox] = []

    def read(self, bbox: BBox) -> SeedLayers:
        self.asked.append(bbox)
        return self._layers


class FakeStore:
    def __init__(self) -> None:
        self.layers: dict[str, int] = {}
        self.meta: dict[str, object] = {}

    def save_layer(self, name: str, features: Sequence[Feature]) -> int:
        self.layers[name] = len(features)
        return len(features) * 100

    def save_meta(self, meta: Mapping[str, object]) -> None:
        self.meta = dict(meta)


class FakeElevation:
    description = "dem:two tiles"

    def crop(self, bbox: BBox) -> Mapping[str, object]:
        return {"bytes": 4096, "width": 1620, "height": 1440}


class FixedClock:
    def now(self) -> datetime:
        return NOW


class RecordingLogger:
    def __init__(self) -> None:
        self.events: list[str] = []

    def info(self, event: str, **fields: LogValue) -> None:
        self.events.append(event)

    def warning(self, event: str, **fields: LogValue) -> None:
        self.events.append(event)

    def error(self, event: str, *, exc: BaseException | None = None, **fields: LogValue) -> None:
        self.events.append(event)


def build(layers: SeedLayers) -> tuple[BuildSeed, FakeSource, FakeStore, RecordingLogger]:
    source, store, logger = FakeSource(layers), FakeStore(), RecordingLogger()
    use_case = BuildSeed(
        source=source,
        store=store,
        elevation=FakeElevation(),
        clock=FixedClock(),
        logger=logger,
    )
    return use_case, source, store, logger


def test_every_layer_is_written_even_when_empty() -> None:
    use_case, _, store, _ = build(SeedLayers(hotels=[HOTEL]))

    report = use_case("sochi", BBOX)

    assert set(store.layers) == {
        "hotels",
        "buildings",
        "pois",
        "coastline",
        "beaches",
        "noise_sources",
        "walk",
    }
    assert store.layers["beaches"] == 0
    assert report.counts["hotels"] == 1


def test_the_bbox_reaches_the_source_unchanged() -> None:
    use_case, source, _, _ = build(SeedLayers())

    use_case("sochi", BBOX)

    assert source.asked == [BBOX]


def test_metadata_records_the_sources_and_the_build_time() -> None:
    use_case, _, store, _ = build(SeedLayers(hotels=[HOTEL]))

    use_case("sochi", BBOX)

    assert store.meta["region"] == "sochi"
    assert store.meta["osm_source"] == "osm:sample.pbf"
    assert store.meta["dem_source"] == "dem:two tiles"
    assert store.meta["built_at"] == NOW.isoformat()
    assert store.meta["bbox"] == [39.55, 43.35, 40.0, 43.75]


def test_the_report_adds_up_the_written_bytes() -> None:
    use_case, _, _, _ = build(SeedLayers(hotels=[HOTEL, HOTEL], walk=[HOTEL]))

    report = use_case("sochi", BBOX)

    assert report.total_bytes == 300


def test_progress_is_reported_through_the_logger() -> None:
    use_case, _, _, logger = build(SeedLayers())

    use_case("sochi", BBOX)

    assert logger.events == ["seed_read_started", "seed_read_finished", "seed_written"]
