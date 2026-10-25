from collections.abc import Sequence
from dataclasses import dataclass

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.geographic_extent import intersection
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.search_areas import SearchAreasPort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort


@dataclass(frozen=True, slots=True)
class Candidates:
    hotels: Sequence[SearchHotelRecord]
    region: str
    bbox: tuple[float, float, float, float] | None
    allow_expand: bool = False
    unsupported: bool = False


async def find_candidates(
    query: str,
    location: str | None,
    region: str,
    bbox: tuple[float, float, float, float] | None,
    uow_factory: UnitOfWorkFactory,
    areas: SearchAreasPort | None,
    semantic: SemanticSearchPort | None,
) -> Candidates:
    if location is None:
        documents = await semantic.search(query, limit=200) if semantic else ()
        ids = tuple(dict.fromkeys(doc.hotel_id for doc in documents))
        async with uow_factory() as uow:
            hotels = await uow.search.by_ids(ids) if ids else ()
        if bbox:
            hotels = [
                h
                for h in hotels
                if bbox[0] <= h.location[0] <= bbox[2] and bbox[1] <= h.location[1] <= bbox[3]
            ]
        return Candidates(hotels, "russia", bbox)
    area = areas.resolve(location) if areas else None
    allow_expand = bbox is None and area is None
    async with uow_factory() as uow:
        if location.casefold() in {"сочи", "sochi", "адлер", "adler"}:
            region = "sochi"
        else:
            region = "russia"
            extent = area.bbox if area else await uow.regions.city_bbox(location)
            if extent is None:
                return Candidates((), region, bbox, unsupported=True)
            if bbox:
                bbox = intersection(bbox, extent)
                if bbox is None:
                    return Candidates((), region, None)
            else:
                bbox = extent
        hotels = await uow.search.list_hotels(region, bbox)
    if area:
        hotels = [hotel for hotel in hotels if area.contains(hotel.location)]
    return Candidates(hotels, region, bbox, allow_expand)
