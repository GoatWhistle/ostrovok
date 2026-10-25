from typing import Protocol


class TerrainTilePort(Protocol):
    def render(self, z: int, x: int, y: int) -> bytes: ...

    def render_relief(self, z: int, x: int, y: int) -> bytes: ...
