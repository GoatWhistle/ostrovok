from typing import Protocol


class SearchArea(Protocol):
    @property
    def bbox(self) -> tuple[float, float, float, float]: ...

    def contains(self, location: tuple[float, float]) -> bool: ...


class SearchAreasPort(Protocol):
    def resolve(self, name: str) -> SearchArea | None: ...
