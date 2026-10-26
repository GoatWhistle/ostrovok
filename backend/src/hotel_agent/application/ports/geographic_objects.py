from typing import Protocol

from hotel_agent.application.ports.search_areas import SearchArea


class GeographicObject(Protocol):
    def area(self, radius_m: float) -> SearchArea: ...

    def nearest(self, location: tuple[float, float]) -> tuple[float, float]: ...


class GeographicObjectsPort(Protocol):
    async def get(self, identifier: str) -> GeographicObject | None: ...
