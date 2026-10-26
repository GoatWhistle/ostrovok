from datetime import date

from pydantic import BaseModel, Field


class SearchRequestSchema(BaseModel):
    query: str
    region_id: str | None = "russia"
    bbox: tuple[float, float, float, float] | None = None
    limit: int = Field(default=20, ge=1, le=100)
    cursor: str | None = None
    compute_missing: bool = True


class ParsedIntentSchema(BaseModel):
    characteristic_key: str
    op: str
    value: bool | float | str | None
    weight: float
    required: bool
    source_text: str


class QueryCorrectionSchema(BaseModel):
    original: str
    corrected: str
    reason: str


class ParsedSchema(BaseModel):
    intents: list[ParsedIntentSchema]
    unmatched_terms: list[str]
    location_hint: str | None = None
    anywhere: bool = False
    normalized_query: str | None = None
    corrections: list[QueryCorrectionSchema] = Field(default_factory=list)
    unsupported_region: str | None = None
    needs_clarification: bool = False
    wants_room: bool = False
    room_preferences_unrestricted: bool = False
    budget: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    adults: int | None = None
