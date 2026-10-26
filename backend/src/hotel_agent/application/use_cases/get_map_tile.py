from math import atan, degrees, pi, sinh

from hotel_agent.application.ports.geography import GeographyContextPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory


class GetMapTile:
    def __init__(
        self, uow: UnitOfWorkFactory, geography: GeographyContextPort | None = None
    ) -> None:
        self._uow = uow
        self._geography = geography

    async def __call__(self, z: int, x: int, y: int) -> bytes:
        async with self._uow() as uow:
            data = await uow.map_tiles.get(z, x, y)
        if data or self._geography is None or z < 16:
            return data
        size = 2**z
        await self._geography.area(
            (
                x / size * 360 - 180,
                degrees(atan(sinh(pi * (1 - 2 * (y + 1) / size)))),
                (x + 1) / size * 360 - 180,
                degrees(atan(sinh(pi * (1 - 2 * y / size)))),
            )
        )
        async with self._uow() as uow:
            return await uow.map_tiles.get(z, x, y)
