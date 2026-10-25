from typing import Protocol


class PlaceLookupPort(Protocol):
    async def coordinates(
        self, name: str, bbox: tuple[float, float, float, float]
    ) -> tuple[float, float] | None: ...

    async def aclose(self) -> None: ...
