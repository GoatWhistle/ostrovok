from datetime import date, datetime

from pydantic import BaseModel

from hotel_agent.application.use_cases.get_hotel_offers import HotelOffers, OfferStatus
from hotel_agent.interfaces.http.supplier_schemas import (
    SupplierDetailsSchema,
    supplier_details_schema,
)


class RoomOfferSchema(BaseModel):
    id: str
    room_name: str
    price_amount: float
    price_currency: str
    available_rooms: int | None
    meal: str | None
    amenities: list[str]
    floor_number: int | None
    room_group_id: str | None
    free_cancellation_before: datetime | None


class SupplierRoomSchema(BaseModel):
    id: str
    name: str
    photos: list[str]
    amenities: list[str]
    size_sqm: float | None
    bedding: str | None


class HotelOffersSchema(BaseModel):
    hotel_id: str
    check_in: date
    check_out: date
    adults: int
    status: OfferStatus
    source: str | None
    sandbox: bool
    checked_at: datetime | None
    offers: list[RoomOfferSchema]
    facilities: list[str]
    room_categories: list[str]
    photo_url: str | None
    room_groups: list[SupplierRoomSchema]
    rates_complete: bool
    details: SupplierDetailsSchema | None


def hotel_offers_schema(result: HotelOffers) -> HotelOffersSchema:
    return HotelOffersSchema(
        hotel_id=result.hotel_id,
        check_in=result.check_in,
        check_out=result.check_out,
        adults=result.adults,
        status=result.status,
        source=result.source,
        sandbox=result.sandbox,
        checked_at=result.checked_at,
        facilities=list(result.facilities),
        room_categories=list(result.room_categories),
        photo_url=result.photo_url,
        rates_complete=result.rates_complete,
        details=supplier_details_schema(result.details) if result.details else None,
        room_groups=[
            SupplierRoomSchema(
                id=r.id,
                name=r.name,
                photos=list(r.photos),
                amenities=list(r.amenities),
                size_sqm=r.size_sqm,
                bedding=r.bedding,
            )
            for r in result.room_groups
        ],
        offers=[
            RoomOfferSchema(
                id=item.id,
                room_name=item.room_name,
                price_amount=item.price_amount,
                price_currency=item.price_currency,
                available_rooms=item.available_rooms,
                meal=item.meal,
                amenities=list(item.amenities),
                floor_number=item.floor_number,
                room_group_id=item.room_group_id,
                free_cancellation_before=item.free_cancellation_before,
            )
            for item in result.offers
        ],
    )
