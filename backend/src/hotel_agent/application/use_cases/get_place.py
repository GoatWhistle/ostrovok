from dataclasses import dataclass
from datetime import timedelta

from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.places import PlaceRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.walk import PlaceWalk
from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.entities import Fact, FactStatus
from hotel_agent.domain.errors import HotelNotFound, PlaceNotFound
from hotel_agent.domain.value_objects import (
    Confidence,
    FactId,
    GeoFeatureId,
    PlaceId,
    Provenance,
    SourceRef,
    Subject,
)

PUBLIC_TAGS = frozenset(
    {
        "name",
        "name:ru",
        "name:en",
        "amenity",
        "tourism",
        "leisure",
        "shop",
        "natural",
        "opening_hours",
        "addr:street",
        "addr:housenumber",
        "addr:city",
        "addr:postcode",
        "cuisine",
        "outdoor_seating",
        "phone",
        "contact:phone",
        "website",
        "contact:website",
        "wheelchair",
    }
)


@dataclass(frozen=True, slots=True, kw_only=True)
class PlaceCard:
    place: PlaceRecord
    name: str | None
    kind: str
    osm_ref: str
    source_url: str
    tags: dict[str, str]
    facts: tuple[Fact, ...]
    walk: PlaceWalk | None


class GetPlace:
    def __init__(self, uow: UnitOfWorkFactory, clock: ClockPort) -> None:
        self._uow = uow
        self._clock = clock

    async def __call__(self, place_id: str, from_hotel: str | None = None) -> PlaceCard:
        async with self._uow() as uow:
            place = await uow.places.get(place_id)
            if place is None:
                raise PlaceNotFound()
            paths: tuple[PlaceWalk, ...] = ()
            if from_hotel:
                if await uow.search.get_hotel(from_hotel) is None:
                    raise HotelNotFound()
                paths = tuple(await uow.walk.routes(from_hotel, (place_id,), 500))
        tags = {
            key: value for key, value in place.tags.items() if key in PUBLIC_TAGS and value.strip()
        }
        osm_type = {"n": "node", "w": "way", "r": "relation"}.get(place.id[0], "node")
        osm_ref = f"{osm_type}/{place.id[1:]}"
        source_url = f"https://www.openstreetmap.org/{osm_ref}"
        facts = tuple(
            Fact(
                id=FactId(f"osm:{place.id}:{key}"),
                subject=Subject.place(PlaceId(place.id)),
                characteristic_key=key,
                value=value,
                unit=None,
                qualifiers={"source_text": value},
                provenance=Provenance(
                    source=SourceRef(source_type=SourceType.OSM, ref=source_url),
                    method="osm_tag@1",
                    confidence=Confidence(0.7),
                    computed_at=place.extracted_at,
                    valid_until=place.extracted_at + timedelta(days=365),
                ),
                status=FactStatus.ACTIVE,
                geo_refs=(GeoFeatureId(f"g_poi_{place.id}"),),
                explanation=f"OpenStreetMap {key}={value}",
            ).at(self._clock.now())
            for key, value in tags.items()
        )
        return PlaceCard(
            place=place,
            name=tags.get("name"),
            kind=next(
                (
                    tags[key]
                    for key in ("amenity", "tourism", "leisure", "shop", "natural")
                    if key in tags
                ),
                "place",
            ),
            osm_ref=osm_ref,
            source_url=source_url,
            tags=tags,
            facts=facts,
            walk=paths[0] if paths else None,
        )
