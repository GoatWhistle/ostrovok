from hotel_agent.application.map_catalog import MapCatalog, MapClass


class GetMapCatalog:
    def __init__(self, catalog: MapCatalog) -> None:
        self._catalog = catalog

    def __call__(self) -> tuple[MapClass, ...]:
        return self._catalog.classes
