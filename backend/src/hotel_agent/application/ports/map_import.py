from collections.abc import Sequence
from typing import Protocol

from hotel_agent.application.dto import Feature
from hotel_agent.application.map_catalog import MapCatalog


class MapImportPort(Protocol):
    def import_layers(
        self, region: str, features: Sequence[Feature], catalog: MapCatalog
    ) -> dict[str, int]: ...
