from typing import Literal

from pydantic import BaseModel, Field

from hotel_agent.application.dto import SearchHotelRecord


class HotelPhotoSchema(BaseModel):
    url: str
    source_url: str | None = None
    kind: Literal["hotel", "room", "surroundings"] = "hotel"


class HotelSummarySchema(BaseModel):
    id: str
    name: str
    address: str | None = None
    location: tuple[float, float]
    stars: int | None = None
    building_id: str | None = None
    height_m: float | None = None
    levels: int | None = None
    thumbnail_url: str | None = None
    photos: list[HotelPhotoSchema] = Field(default_factory=list)


def hotel_summary_schema(hotel: SearchHotelRecord) -> HotelSummarySchema:
    return HotelSummarySchema(
        id=hotel.id,
        name=hotel.name,
        address=hotel.address,
        location=hotel.location,
        stars=hotel.stars,
        building_id=hotel.building_id,
        height_m=hotel.height_m,
        levels=hotel.levels,
        thumbnail_url=hotel.photos[0].url if hotel.photos else None,
        photos=[
            HotelPhotoSchema(url=photo.url, source_url=photo.source_url, kind=photo.kind)
            for photo in hotel.photos
        ],
    )
