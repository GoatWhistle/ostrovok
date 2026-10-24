from collections.abc import Mapping, Sequence
from pathlib import Path

from hotel_agent.adapters.seed import files
from hotel_agent.application.dto import Feature


class GeoJsonSeedStore:
    def __init__(self, directory: Path) -> None:
        self._directory = directory

    def save_layer(self, name: str, features: Sequence[Feature]) -> int:
        return files.write_layer(self._directory, name, features)

    def save_meta(self, meta: Mapping[str, object]) -> None:
        files.write_meta(self._directory, dict(meta))
