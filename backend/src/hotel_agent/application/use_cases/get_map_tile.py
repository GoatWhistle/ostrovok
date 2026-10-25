from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class GetMapTile:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, z: int, x: int, y: int) -> bytes:
        async with self._uow() as uow:
            return await uow.map_tiles.get(z, x, y)
