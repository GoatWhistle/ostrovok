from pathlib import Path

from hotel_agent.application.ports.walk import WalkSourcePort, WalkStorePort


class PrecomputeWalk:
    def __init__(self, source: WalkSourcePort, store: WalkStorePort) -> None:
        self._source = source
        self._store = store

    async def __call__(self, region: str, directory: Path) -> int:
        paths = self._source.calculate(directory)
        return await self._store.save(region, paths)
