from datetime import date

from pydantic import BaseModel

from hotel_agent.application.ports.supplier_details import SupplierDetails, SupplierRoom


class SupplierPhotoSchema(BaseModel):
    url: str
    category: str | None


class SupplierAmenitySchema(BaseModel):
    name: str
    free: bool


class SupplierAmenityGroupSchema(BaseModel):
    name: str
    amenities: list[SupplierAmenitySchema]


class SupplierDescriptionSchema(BaseModel):
    title: str
    paragraphs: list[str]


class SupplierNearbyPlaceSchema(BaseModel):
    name: str
    distance_m: int
    kind: str | None


class SupplierRegistryCategorySchema(BaseModel):
    category: str
    rooms: int


class SupplierRegistrySchema(BaseModel):
    record: str
    name: str | None
    address: str | None
    link: str | None
    categories: list[SupplierRegistryCategorySchema]
    valid_until: date | None


class SupplierFactsSchema(BaseModel):
    floors_number: int | None
    rooms_number: int | None
    star_rating: int | None
    year_built: int | None
    year_renovated: int | None
    kind: str | None
    hotel_wifi: bool | None
    room_wifi: bool | None
    registry: SupplierRegistrySchema | None


class SupplierRatingScoreSchema(BaseModel):
    name: str
    score: float


class SupplierRatingSchema(BaseModel):
    total: float | None
    reviews_count: int | None
    detailed: list[SupplierRatingScoreSchema]


class SupplierDetailsSchema(BaseModel):
    supplier_id: str
    page_url: str
    name: str
    address: str | None
    city: str | None
    location: list[float] | None
    photos: list[SupplierPhotoSchema]
    facts: SupplierFactsSchema
    amenity_groups: list[SupplierAmenityGroupSchema]
    description: list[SupplierDescriptionSchema]
    nearby: list[SupplierNearbyPlaceSchema]
    rating: SupplierRatingSchema | None
    check_in_from: str | None
    check_out_until: str | None
    email: str | None
    phone: str | None


class SupplierRoomSchema(BaseModel):
    id: str
    name: str
    photos: list[str]
    amenities: list[str]
    size_sqm: float | None
    bedding: str | None
    views: list[str]
    floor: int | None
    main_places: int | None
    extra_places: int | None


def supplier_room_schema(room: SupplierRoom) -> SupplierRoomSchema:
    return SupplierRoomSchema(
        id=room.id,
        name=room.name,
        photos=list(room.photos),
        amenities=list(room.amenities),
        size_sqm=room.size_sqm,
        bedding=room.bedding,
        views=list(room.views),
        floor=room.floor,
        main_places=room.main_places,
        extra_places=room.extra_places,
    )


def supplier_details_schema(details: SupplierDetails) -> SupplierDetailsSchema:
    facts = details.facts
    registry = facts.registry
    rating = details.rating
    return SupplierDetailsSchema(
        supplier_id=details.supplier_id,
        page_url=details.page_url,
        name=details.name,
        address=details.address,
        city=details.city,
        location=list(details.location) if details.location else None,
        photos=[
            SupplierPhotoSchema(url=photo.url, category=photo.category) for photo in details.photos
        ],
        facts=SupplierFactsSchema(
            floors_number=facts.floors_number,
            rooms_number=facts.rooms_number,
            star_rating=facts.star_rating,
            year_built=facts.year_built,
            year_renovated=facts.year_renovated,
            kind=facts.kind,
            hotel_wifi=facts.hotel_wifi,
            room_wifi=facts.room_wifi,
            registry=SupplierRegistrySchema(
                record=registry.record,
                name=registry.name,
                address=registry.address,
                link=registry.link,
                categories=[
                    SupplierRegistryCategorySchema(category=item.category, rooms=item.rooms)
                    for item in registry.categories
                ],
                valid_until=registry.valid_until,
            )
            if registry
            else None,
        ),
        amenity_groups=[
            SupplierAmenityGroupSchema(
                name=group.name,
                amenities=[
                    SupplierAmenitySchema(name=item.name, free=item.free)
                    for item in group.amenities
                ],
            )
            for group in details.amenity_groups
        ],
        description=[
            SupplierDescriptionSchema(title=section.title, paragraphs=list(section.paragraphs))
            for section in details.description
        ],
        nearby=[
            SupplierNearbyPlaceSchema(name=place.name, distance_m=place.distance_m, kind=place.kind)
            for place in details.nearby
        ],
        rating=SupplierRatingSchema(
            total=rating.total,
            reviews_count=rating.reviews_count,
            detailed=[
                SupplierRatingScoreSchema(name=score.name, score=score.score)
                for score in rating.detailed
            ],
        )
        if rating
        else None,
        check_in_from=details.check_in_from,
        check_out_until=details.check_out_until,
        email=details.email,
        phone=details.phone,
    )
