from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from hotel_agent.application.use_cases.get_place import PlaceCard
from hotel_agent.interfaces.http.fact_schemas import fact_schema
from hotel_agent.interfaces.http.search_schemas import FactBriefSchema


class PlaceSourceSchema(BaseModel):
    type: Literal["osm_tag"] = "osm_tag"
    extracted_at: datetime
    license: Literal["ODbL"] = "ODbL"
    url: str


class PlaceWalkSchema(BaseModel):
    distance_m: float
    minutes: float | None
    geo_ref: str
    mode: Literal["graph", "straight"]


class PlaceCardSchema(BaseModel):
    id: str
    name: str | None
    kind: str
    location: tuple[float, float]
    osm_ref: str
    tags: dict[str, str]
    source: PlaceSourceSchema
    facts: list[FactBriefSchema]
    walk: PlaceWalkSchema | None


def place_schema(card: PlaceCard) -> PlaceCardSchema:
    walk = card.walk
    return PlaceCardSchema(
        id=card.place.id,
        name=card.name,
        kind=card.kind,
        location=card.place.location,
        osm_ref=card.osm_ref,
        tags=card.tags,
        source=PlaceSourceSchema(extracted_at=card.place.extracted_at, url=card.source_url),
        facts=[
            FactBriefSchema.model_validate(fact_schema(fact).model_dump()) for fact in card.facts
        ],
        walk=PlaceWalkSchema(
            distance_m=walk.meters,
            minutes=walk.minutes,
            geo_ref=f"g_walk_{walk.hotel_id}_{walk.place_id}",
            mode=walk.mode,
        )
        if walk
        else None,
    )
