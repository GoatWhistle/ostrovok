from datetime import datetime, timedelta

from hotel_agent.application.agent.sunset_geometry import (
    FLOOR_HEIGHT_M,
    SEASON,
    arc_middle,
    faces_arc,
    minimum_floor,
    sunset_arc,
)
from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort

KEY = "sunset_view"
METHOD = "sunset_view@1"
OBSERVER_M = 15.0
RADIUS_M = 500.0
MONTHS = "апрель — август"


class PrecomputeSunset:
    def __init__(self, uow: UnitOfWorkFactory, views: ViewAssessmentPort, clock: ClockPort) -> None:
        self._uow, self._views, self._clock = uow, views, clock

    async def __call__(self, region: str) -> int:
        async with self._uow() as uow:
            hotels = await uow.search.list_hotels(region, None)
        now = self._clock.now()
        records = [row for hotel in hotels if (row := await self._hotel(hotel, now)) is not None]
        if records:
            async with self._uow() as uow:
                await uow.facts.save(records)
                await uow.commit()
        return len(records)

    async def _hotel(self, hotel: SearchHotelRecord, now: datetime) -> SearchFactRecord | None:
        arc = sunset_arc(hotel.location[0], hotel.location[1], now.year)
        if arc is None:
            return None
        async with self._uow() as uow:
            facades = await uow.search.list_facades(hotel.id)
        facing = tuple(item for item in facades if faces_arc(item.azimuth_deg, arc))
        if not facades:
            return None
        azimuth = arc_middle(arc)
        if not facing:
            return self._fact(hotel, arc, azimuth, now, False, None, 0, len(facades))
        measured = (
            await self._views.assess({hotel.id: hotel.location}, azimuth, OBSERVER_M, RADIUS_M)
        ).get(hotel.id)
        if measured is None:
            return None
        floor = minimum_floor(measured["ground_elevation_m"], measured["skyline_elevation_m"])
        return self._fact(hotel, arc, azimuth, now, None, floor, len(facing), len(facades))

    def _fact(
        self,
        hotel: SearchHotelRecord,
        arc: tuple[float, float],
        azimuth: float,
        now: datetime,
        value: bool | None,
        floor: int | None,
        facing: int,
        facades: int,
    ) -> SearchFactRecord:
        reach = _reachable(hotel)
        settled = value if floor is None else (None if reach is None else floor <= reach)
        return SearchFactRecord(
            hotel_id=hotel.id,
            id=f"f_{KEY}_{hotel.id}",
            characteristic_key=KEY,
            value=settled,
            unit=None,
            qualifiers={
                "sunset_azimuth_from_deg": round(arc[0], 1),
                "sunset_azimuth_to_deg": round(arc[1], 1),
                "checked_azimuth_deg": round(azimuth, 1),
                "months": MONTHS,
                "facades_facing_sunset": facing,
                "facades_total": facades,
                **({"minimum_floor": floor} if floor is not None else {}),
                **({"floors_known": reach} if reach is not None else {}),
            },
            source_type="computed",
            source_id=None,
            method=METHOD,
            confidence=0.6 if settled is None else 0.75,
            computed_at=now,
            valid_until=now + timedelta(days=365),
            status="active",
            geo_refs=(),
            explanation=_explain(arc, floor, facing, reach),
            facade_azimuth=None,
        )


def _reachable(hotel: SearchHotelRecord) -> int | None:
    if hotel.levels:
        return int(hotel.levels)
    if hotel.height_m:
        return int(hotel.height_m // FLOOR_HEIGHT_M)
    return None


def _explain(arc: tuple[float, float], floor: int | None, facing: int, reach: int | None) -> str:
    window = f"Закат в {MONTHS} садится по азимуту {arc[0]:.0f}–{arc[1]:.0f}°."
    if not facing:
        return f"{window} Ни один фасад здания не выходит на эту сторону."
    where = f"{window} На закатную сторону выходит фасадов: {facing}."
    if floor is None:
        return f"{where} Профиль горизонта не рассчитан."
    height = f"{where} Горизонт по DEM и высотам зданий открывается с {floor}-го этажа."
    if reach is None:
        return f"{height} Этажность здания неизвестна, поэтому подтвердить нельзя."
    return f"{height} В здании этажей: {reach}."


def season_months() -> tuple[int, int]:
    return SEASON
