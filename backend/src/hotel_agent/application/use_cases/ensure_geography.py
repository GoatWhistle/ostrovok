import asyncio
from collections.abc import Callable
from datetime import timedelta
from math import isfinite

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.geography import (
    GeographicBounds,
    GeographySourcePort,
    GeographyUnitOfWork,
)
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.view_geometry import PhysicalArea


class EnsureGeography:
    def __init__(
        self,
        uow: Callable[[], GeographyUnitOfWork],
        source: GeographySourcePort,
        clock: ClockPort,
        logger: LoggerPort,
    ) -> None:
        self._uow, self._source, self._clock, self._logger = uow, source, clock, logger
        self._locks = tuple(asyncio.Lock() for _ in range(32))
        self._failed: dict[GeographicBounds, float] = {}

    async def area(self, bbox: GeographicBounds, region: str = "russia") -> PhysicalArea | None:
        west, south, east, north = bbox
        if (
            not all(isfinite(value) for value in bbox)
            or not -180 <= west < east <= 180
            or not -85 <= south < north <= 85
            or (east - west) * (north - south) > 0.01
        ):
            raise ValueError(
                "A valid geography bounding box at most 0.01 square degrees is required"
            )
        bbox = (round(west, 7), round(south, 7), round(east, 7), round(north, 7))
        async with self._locks[hash(bbox) % len(self._locks)]:
            now = self._clock.now()
            async with self._uow() as uow:
                cached = await uow.geography.cached(bbox, now)
            if cached is not None:
                return cached
            if self._failed.get(bbox, 0) > now.timestamp():
                return None
            snapshot = await self._source.fetch(bbox)
            if snapshot is None:
                if len(self._failed) >= 512:
                    self._failed = {
                        key: until for key, until in self._failed.items() if until > now.timestamp()
                    }
                    if len(self._failed) >= 512:
                        self._failed.pop(next(iter(self._failed)))
                self._failed[bbox] = (now + timedelta(minutes=5)).timestamp()
                self._logger.warning("geography_unavailable", bbox=str(bbox))
                return None
            async with self._uow() as uow:
                await uow.geography.save(snapshot, region)
                await uow.commit()
            self._logger.info(
                "geography_downloaded",
                bbox=str(bbox),
                complete=snapshot.complete,
                counts=str(snapshot.layers.counts()),
            )
            async with self._uow() as uow:
                return await uow.geography.cached(bbox, now)
