from collections.abc import Callable, Mapping

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.geography import GeographyUnitOfWork


class RefreshHotelHeights:
    def __init__(self, uow: Callable[[], GeographyUnitOfWork], clock: ClockPort) -> None:
        self._uow, self._clock = uow, clock

    async def __call__(self, region: str) -> Mapping[str, int]:
        async with self._uow() as uow:
            result = await uow.geography.refresh_heights(region, self._clock.now())
            await uow.commit()
        return result
