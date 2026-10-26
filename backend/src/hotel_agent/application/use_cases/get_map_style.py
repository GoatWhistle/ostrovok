from dataclasses import dataclass

from hotel_agent.application.ports.map_style import BasemapRecord, MapStylePort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import RegionNotFound


@dataclass(frozen=True, slots=True, kw_only=True)
class MapStyle:
    region_id: str
    bbox: tuple[float, float, float, float]
    catalog_version: str
    tiles_version: str | None
    basemap: BasemapRecord | None
    terrain: bool


class GetMapStyle:
    def __init__(self, uow: UnitOfWorkFactory, files: MapStylePort, catalog_version: str) -> None:
        self._uow, self._files, self._catalog_version = uow, files, catalog_version

    async def __call__(self, region_id: str) -> MapStyle:
        async with self._uow() as uow:
            regions = {item.id: item for item in await uow.regions.list_loaded()}
        region = regions.get(region_id)
        if region is None:
            raise RegionNotFound()
        record = self._files.region(region_id)
        return MapStyle(
            region_id=region_id,
            bbox=region.bbox,
            catalog_version=self._catalog_version,
            tiles_version=record.tiles_version,
            basemap=record.basemap,
            terrain=record.terrain,
        )
