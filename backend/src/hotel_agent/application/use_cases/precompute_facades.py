from collections.abc import Mapping

from hotel_agent.application.ports.facades import FacadeExtractorPort, FacadeStorePort


class PrecomputeFacades:
    def __init__(self, extractor: FacadeExtractorPort, store: FacadeStorePort) -> None:
        self._extractor = extractor
        self._store = store

    async def __call__(self, region: str) -> Mapping[str, int]:
        facades = [
            facade
            for footprint in await self._store.footprints(region)
            for facade in self._extractor.extract(footprint)
        ]
        count = await self._store.save(region, facades)
        noise_count = await self._store.compute_noise(region)
        return {"facades": count, "noise_level": noise_count}
