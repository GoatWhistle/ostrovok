from collections.abc import Mapping, Sequence
from pathlib import Path

from hotel_agent.adapters.seed.files import read_layer, read_meta
from hotel_agent.application.dto import Feature


class GeoJsonSeedReader:
    def read_meta(self, directory: Path) -> Mapping[str, object]:
        return read_meta(directory)

    def read_layer(self, directory: Path, name: str) -> Sequence[Feature]:
        return read_layer(directory, name)
