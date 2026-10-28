from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from hotel_agent.application.use_cases.hotelier_entries import ManageHotelierEntries


class EntryInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=1000)


class EntrySchema(EntryInput):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: str
    hotel_id: str
    updated_at: datetime


class EntryListSchema(BaseModel):
    items: list[EntrySchema]


def build_router(entries: ManageHotelierEntries) -> APIRouter:
    router = APIRouter(tags=["hotelier"])

    @router.get("/hotelier/{hotel_id}/entries", response_model=EntryListSchema)
    async def listing(hotel_id: str) -> EntryListSchema:
        return EntryListSchema(
            items=[EntrySchema.model_validate(e) for e in await entries.list(hotel_id)]
        )

    @router.put("/hotelier/{hotel_id}/entries/{entry_id}", response_model=EntrySchema)
    async def save(hotel_id: str, entry_id: UUID, body: EntryInput) -> EntrySchema:
        return EntrySchema.model_validate(
            await entries.save(hotel_id, str(entry_id), body.title, body.description)
        )

    return router
