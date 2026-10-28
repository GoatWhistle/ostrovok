from collections.abc import Mapping

from hotel_agent.application.ports.precompute import PrecomputePort


class Precompute:
    def __init__(self, calculator: PrecomputePort) -> None:
        self._calculator = calculator

    async def __call__(self, region: str) -> Mapping[str, int]:
        return await self._calculator.run(region)

    async def stamp(self, region: str, osm_source: str, dem_source: str) -> Mapping[str, int]:
        return await self._calculator.stamp_sources(region, osm_source, dem_source)
