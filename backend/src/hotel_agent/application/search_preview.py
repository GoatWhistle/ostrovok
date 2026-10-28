import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from contextlib import asynccontextmanager, suppress
from math import inf

from hotel_agent.application import progress
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.geographic_objects import GeographicObjectsPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.walk import PlaceWalk
from hotel_agent.application.search_destinations import destinations
from hotel_agent.application.search_selection import Candidate
from hotel_agent.application.spatial_matching import distance_m
from hotel_agent.domain.query import ParsedQuery


class SearchPreview:
    def __init__(self, geographic: GeographicObjectsPort | None = None) -> None:
        self.geographic = geographic
        self.paths: dict[str, PlaceWalk] = {}
        self.terms: dict[str, str] = {}
        self.names: dict[str, str | None] = {}

    async def calculate(
        self,
        parsed: ParsedQuery,
        hotels: Sequence[SearchHotelRecord],
        region: str,
        bbox: tuple[float, float, float, float] | None,
        factory: UnitOfWorkFactory,
        prune: bool = False,
    ) -> None:
        resolved = await destinations(parsed, hotels, region, bbox, factory, self.geographic)
        if resolved is None:
            return
        request, matches, places, shapes = resolved
        async with factory() as uow:
            onsite = await uow.walk.in_buildings([h.id for h in hotels], list(places))
        self.names.update({id: place.name or None for id, place in places.items()})
        by_id = {h.id: h for h in hotels}
        for path in onsite:
            if path.hotel_id not in self.paths and path.place_id in matches.get(path.hotel_id, ()):
                self.paths[path.hotel_id] = path
                self.terms[path.hotel_id] = request.source_text
                progress.step("preview", preview=self.scene(by_id[path.hotel_id]))
        points = {id: place.location for id, place in places.items()}
        endpoints = {
            h.id: {
                id: shapes[id].nearest(h.location) if id in shapes else points[id]
                for id in matches.get(h.id, ())
                if id in points
            }
            for h in hotels
        }
        lower = {
            h.id: min(
                (distance_m(h.location, position) for position in endpoints[h.id].values()),
                default=0,
            )
            for h in hotels
        }
        eligible = {h.id for h in hotels}
        semaphore = asyncio.Semaphore(4)

        async def visit(hotel: SearchHotelRecord) -> None:
            ids = matches.get(hotel.id, ())
            if not ids or hotel.id in self.paths:
                return
            async with semaphore, factory() as uow:
                best = min(
                    (
                        p.meters
                        for id, p in self.paths.items()
                        if id in eligible and p.mode != "straight"
                    ),
                    default=inf,
                )
                if prune and lower[hotel.id] > best:
                    return
                paths = (
                    await uow.walk.to_points(hotel.id, endpoints[hotel.id], request.radius_m)
                    if shapes or not parsed.nearby_objects
                    else await uow.walk.routes(hotel.id, ids, request.radius_m)
                )
                if not paths:
                    return
                path = min(paths, key=lambda p: (p.mode == "straight", p.meters))
                self.paths[hotel.id] = path
                self.terms[hotel.id] = request.source_text
                progress.step("preview", preview=self.scene(hotel))

        async with asyncio.TaskGroup() as group:
            ordered = sorted(
                (h for h in hotels if matches.get(h.id) and h.id not in self.paths),
                key=lambda h: lower[h.id],
            )
            for hotel in ordered if prune else ordered[:4]:
                group.create_task(visit(hotel))

    def scene(self, hotel: SearchHotelRecord) -> dict[str, object]:
        path = self.paths.get(hotel.id)
        return {
            "id": hotel.id,
            "name": hotel.name,
            "location": hotel.location,
            "rating": hotel.rating,
            "term": self.terms.get(hotel.id),
            "route": path.geometry if path and path.mode != "onsite" else None,
            "place_name": self.names.get(path.place_id) if path else None,
            "place_location": path.geometry.get("coordinates")
            if path and path.mode == "onsite"
            else None,
            "meters": path.meters if path else None,
            "minutes": path.minutes if path else None,
            "mode": path.mode if path else None,
            "place_id": path.place_id if path else None,
        }

    def prioritizer(
        self,
        parsed: ParsedQuery,
        region: str,
        bbox: tuple[float, float, float, float] | None,
        factory: UnitOfWorkFactory,
    ) -> Callable[[Sequence[Candidate]], Awaitable[Sequence[Candidate]]]:
        async def prioritize(candidates: Sequence[Candidate]) -> Sequence[Candidate]:
            best = max((scored.score for _, scored in candidates), default=0)
            hotels = [hotel for hotel, scored in candidates if scored.score == best]
            await self.calculate(parsed, hotels, region, bbox, factory, prune=True)
            return self.order(candidates)

        return prioritize

    def order(self, candidates: Sequence[Candidate]) -> list[Candidate]:
        def priority(item: Candidate) -> tuple[float, int, float, float]:
            hotel, scored = item
            path = self.paths.get(hotel.id)
            mode = {"onsite": 0, "graph": 1, "straight": 2}
            return (
                -scored.score,
                mode.get(path.mode, 3) if path else 3,
                path.meters if path else inf,
                -(hotel.rating or 0),
            )

        return sorted(candidates, key=priority)

    def finish(self, candidates: Sequence[Candidate]) -> list[Candidate]:
        ordered = self.order(candidates)
        if ordered:
            progress.step("winner", preview=self.scene(ordered[0][0]))
        return ordered


@asynccontextmanager
async def search_preview(
    parsed: ParsedQuery,
    hotels: Sequence[SearchHotelRecord],
    region: str,
    bbox: tuple[float, float, float, float] | None,
    factory: UnitOfWorkFactory,
    geographic: GeographicObjectsPort | None = None,
) -> AsyncIterator[tuple[SearchPreview, asyncio.Task[None]]]:
    preview = SearchPreview(geographic)
    task = asyncio.create_task(preview.calculate(parsed, hotels, region, bbox, factory))
    try:
        yield preview, task
    finally:
        if not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        elif not task.cancelled():
            task.exception()
