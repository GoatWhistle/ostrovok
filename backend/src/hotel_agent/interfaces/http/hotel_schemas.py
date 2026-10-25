from collections.abc import Mapping
from datetime import date, datetime

from pydantic import BaseModel, Field

from hotel_agent.application.dto import BuildingRecord, SearchHotelRecord
from hotel_agent.application.use_cases.get_hotel_card import HotelCard
from hotel_agent.application.use_cases.get_hotel_offers import HotelOffers, OfferStatus
from hotel_agent.application.use_cases.get_hotel_scene import HotelScene
from hotel_agent.domain.entities import Fact
from hotel_agent.interfaces.http.schemas import CameraSchema
from hotel_agent.interfaces.http.search_schemas import (
    BuildingFeatureSchema,
    FactBriefSchema,
    HotelSummarySchema,
)


class ProvenanceSchema(BaseModel):
    source_type: str
    source_ref: str | None = None
    method: str
    confidence: float
    computed_at: datetime
    valid_until: datetime | None = None


class FactSchema(FactBriefSchema):
    subject: str
    qualifiers: dict[str, object]
    explanation: str
    provenance: ProvenanceSchema


class FactDetailSchema(FactSchema):
    history: list[FactSchema] = Field(default_factory=list)
    conflicts: list[dict[str, object]] = Field(default_factory=list)


class HotelCardSchema(BaseModel):
    hotel: HotelSummarySchema
    rooms: list["RoomSchema"] = Field(default_factory=list)
    facilities_ru: list[str] = Field(default_factory=list)
    facilities_en: list[str] = Field(default_factory=list)
    facts: list[FactSchema]
    conflicts: list[dict[str, object]] = Field(default_factory=list)
    stale_count: int = 0
    open_questions: int = 0
    camera: CameraSchema


class RoomSchema(BaseModel):
    id: str
    name: str
    capacity: int
    floor_range: tuple[int, int] | None
    facade_ids: list[str]
    price_amount: float | None = None
    price_currency: str | None = None
    included: list[str]


class RoomOfferSchema(BaseModel):
    id: str
    room_name: str
    price_amount: float
    price_currency: str
    available_rooms: int | None
    meal: str | None
    amenities: list[str]
    floor_number: int | None


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
            )
            for item in result.offers
        ],
    )


class FeatureCollectionSchema(BaseModel):
    type: str = "FeatureCollection"
    features: list[BuildingFeatureSchema]


class FacadeSchema(BaseModel):
    id: str
    azimuth_deg: float
    label: str
    geometry: dict[str, object]
    facts: list[FactBriefSchema] = Field(default_factory=list)


class SceneCamerasSchema(BaseModel):
    overview: CameraSchema
    best_match: CameraSchema
    by_facade: dict[str, CameraSchema]


class HotelSceneSchema(BaseModel):
    hotel_id: str
    building: FeatureCollectionSchema
    facades: list[FacadeSchema]
    context_buildings: FeatureCollectionSchema
    cameras: SceneCamerasSchema
    terrain: dict[str, object]


def hotel_card_schema(card: HotelCard) -> HotelCardSchema:
    hotel = card.hotel
    return HotelCardSchema(
        hotel=_hotel_summary(hotel),
        rooms=[
            RoomSchema(
                id=item.id,
                name=item.name,
                capacity=item.capacity,
                floor_range=(item.floor_min, item.floor_max)
                if item.floor_min is not None and item.floor_max is not None
                else None,
                facade_ids=list(item.facade_ids),
                price_amount=item.price_amount,
                price_currency=item.price_currency,
                included=list(item.included),
            )
            for item in card.rooms
        ],
        facilities_ru=list(card.supplier_content.facilities_ru) if card.supplier_content else [],
        facilities_en=list(card.supplier_content.facilities_en) if card.supplier_content else [],
        facts=[fact_schema(fact) for fact in card.facts],
        camera=_camera(hotel.location, 0),
    )


def hotel_scene_schema(scene: HotelScene) -> HotelSceneSchema:
    hotel = scene.hotel
    building = []
    if hotel.building_id and hotel.footprint:
        building.append(
            BuildingFeatureSchema(
                id=hotel.building_id,
                geometry=hotel.footprint,
                properties={
                    "building_id": hotel.building_id,
                    "hotel_id": hotel.id,
                    "is_hotel": True,
                    "height_m": hotel.height_m,
                    "min_height_m": 0,
                    "levels": hotel.levels,
                    "height_fact_id": f"f_height_{hotel.id}",
                },
            )
        )
    by_facade = {
        item.id: _camera(hotel.location, (item.azimuth_deg + 180) % 360) for item in scene.facades
    }
    overview = _camera(hotel.location, 0)
    return HotelSceneSchema(
        hotel_id=hotel.id,
        building=FeatureCollectionSchema(features=building),
        facades=[
            FacadeSchema(
                id=item.id,
                azimuth_deg=item.azimuth_deg,
                label=item.label,
                geometry=item.geometry,
            )
            for item in scene.facades
        ],
        context_buildings=FeatureCollectionSchema(
            features=[_context_feature(item) for item in scene.context_buildings]
        ),
        cameras=SceneCamerasSchema(
            overview=overview,
            best_match=next(iter(by_facade.values()), overview),
            by_facade=by_facade,
        ),
        terrain={
            "dem_source": "Copernicus GLO-30" if hotel.region_id == "sochi" else "Mapterhorn",
            "terrain_tiles_url": "/api/v1/map/terrain/{z}/{x}/{y}.png",
        },
    )


def _context_feature(item: BuildingRecord) -> BuildingFeatureSchema:
    return BuildingFeatureSchema(
        id=item.id,
        geometry=item.geometry,
        properties={
            "building_id": item.id,
            "is_hotel": False,
            "height_m": item.height_m,
            "min_height_m": 0,
            "levels": item.levels,
            "height_estimated": item.height_estimated,
        },
    )


def _hotel_summary(hotel: SearchHotelRecord) -> HotelSummarySchema:
    return HotelSummarySchema(
        id=hotel.id,
        name=hotel.name,
        address=hotel.address,
        location=hotel.location,
        stars=hotel.stars,
        building_id=hotel.building_id,
        height_m=hotel.height_m,
        levels=hotel.levels,
    )


def fact_schema(fact: Fact) -> FactSchema:
    label = f"{fact.characteristic_key}: {fact.value} {fact.unit or ''}".strip()
    return FactSchema(
        fact_id=str(fact.id),
        characteristic_key=fact.characteristic_key,
        value=dict(fact.value) if isinstance(fact.value, Mapping) else fact.value,
        unit=fact.unit,
        label=label,
        confidence=fact.confidence.value,
        source_type=fact.provenance.source_type,
        status=fact.status,
        geo_refs=[str(ref) for ref in fact.geo_refs],
        subject=str(fact.subject),
        qualifiers=dict(fact.qualifiers),
        explanation=fact.explanation,
        provenance=ProvenanceSchema(
            source_type=fact.provenance.source_type,
            source_ref=fact.provenance.source.ref,
            method=fact.provenance.method,
            confidence=fact.confidence.value,
            computed_at=fact.provenance.computed_at,
            valid_until=fact.provenance.valid_until,
        ),
    )


def _camera(center: tuple[float, float], bearing: float) -> CameraSchema:
    return CameraSchema(center=center, zoom=17, pitch=60, bearing=bearing)
