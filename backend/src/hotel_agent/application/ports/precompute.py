from collections.abc import Mapping
from typing import Protocol


class PrecomputePort(Protocol):
    async def run(self, region: str) -> Mapping[str, int]: ...
