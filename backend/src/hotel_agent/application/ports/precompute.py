from collections.abc import Mapping
from typing import Protocol


class PrecomputePort(Protocol):
    async def run(self, region: str) -> Mapping[str, int]: ...

    async def stamp_sources(
        self, region: str, osm_source: str, dem_source: str
    ) -> Mapping[str, int]: ...
