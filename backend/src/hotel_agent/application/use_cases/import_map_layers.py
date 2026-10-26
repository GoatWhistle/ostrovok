from collections.abc import Sequence

from hotel_agent.application.dto import Feature
from hotel_agent.application.map_catalog import MapCatalog
from hotel_agent.application.ports.map_import import MapImportPort


class ImportMapLayers:
    def __init__(self, repository: MapImportPort, catalog: MapCatalog) -> None:
        self._repository = repository
        self._catalog = catalog

    def __call__(self, region: str, features: Sequence[Feature]) -> dict[str, int]:
        return self._repository.import_layers(region, features, self._catalog)
