from hotel_agent.application.ports.terrain import TerrainTilePort


class GetTerrainTile:
    def __init__(self, terrain: TerrainTilePort) -> None:
        self._terrain = terrain

    def __call__(self, z: int, x: int, y: int) -> bytes:
        return self._terrain.render(z, x, y)

    def relief(self, z: int, x: int, y: int) -> bytes:
        return self._terrain.render_relief(z, x, y)
