from dataclasses import dataclass
from datetime import date
from typing import Protocol

from hotel_agent.domain.hotel_identity import HotelIdentity


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierPhoto:
    url: str
    category: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierAmenity:
    name: str
    free: bool = False


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierAmenityGroup:
    name: str
    amenities: tuple[SupplierAmenity, ...]


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierDescriptionSection:
    title: str
    paragraphs: tuple[str, ...]


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierNearbyPlace:
    name: str
    distance_m: int
    kind: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierRegistryCategory:
    category: str
    rooms: int


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierRegistry:
    record: str
    name: str | None = None
    address: str | None = None
    link: str | None = None
    categories: tuple[SupplierRegistryCategory, ...] = ()
    valid_until: date | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierHotelFacts:
    floors_number: int | None = None
    rooms_number: int | None = None
    star_rating: int | None = None
    year_built: int | None = None
    year_renovated: int | None = None
    kind: str | None = None
    hotel_wifi: bool | None = None
    room_wifi: bool | None = None
    registry: SupplierRegistry | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierRatingScore:
    name: str
    score: float


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierRating:
    total: float | None = None
    reviews_count: int | None = None
    detailed: tuple[SupplierRatingScore, ...] = ()


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierDetails:
    supplier_id: str
    page_url: str
    name: str
    address: str | None = None
    city: str | None = None
    location: tuple[float, float] | None = None
    photos: tuple[SupplierPhoto, ...] = ()
    facilities: tuple[str, ...] = ()
    facts: SupplierHotelFacts = SupplierHotelFacts()
    amenity_groups: tuple[SupplierAmenityGroup, ...] = ()
    description: tuple[SupplierDescriptionSection, ...] = ()
    nearby: tuple[SupplierNearbyPlace, ...] = ()
    rating: SupplierRating | None = None
    check_in_from: str | None = None
    check_out_until: str | None = None
    email: str | None = None
    phone: str | None = None


@dataclass(frozen=True, slots=True)
class SupplierRoom:
    id: str
    name: str
    photos: tuple[str, ...]
    amenities: tuple[str, ...]
    size_sqm: float | None = None
    bedding: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class SupplierHotel:
    details: SupplierDetails
    rooms: tuple[SupplierRoom, ...] = ()


class HotelDetailsPort(Protocol):
    source: str
    sandbox: bool

    async def details(
        self, hotel: HotelIdentity, residency: str = "ru"
    ) -> SupplierHotel | None: ...
