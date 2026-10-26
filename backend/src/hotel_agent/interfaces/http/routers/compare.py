from fastapi import APIRouter
from pydantic import BaseModel, Field

from hotel_agent.application.use_cases.compare_hotels import CompareHotels
from hotel_agent.interfaces.http.fact_schemas import fact_schema
from hotel_agent.interfaces.http.search_schemas import FactBriefSchema


class CompareRequest(BaseModel):
    hotel_ids: list[str] = Field(min_length=2, max_length=5)
    characteristic_keys: list[str] | None = None


class CompareRowSchema(BaseModel):
    hotel_id: str
    cells: dict[str, FactBriefSchema]


class CompareResponse(BaseModel):
    characteristic_keys: list[str]
    rows: list[CompareRowSchema]


def build_router(compare_hotels: CompareHotels) -> APIRouter:
    router = APIRouter(tags=["hotels"])

    @router.post("/compare", response_model=CompareResponse)
    async def compare(request: CompareRequest) -> CompareResponse:
        result = await compare_hotels(request.hotel_ids, request.characteristic_keys)
        return CompareResponse(
            characteristic_keys=list(result.characteristic_keys),
            rows=[
                CompareRowSchema(
                    hotel_id=row.hotel_id,
                    cells={
                        key: FactBriefSchema.model_validate(fact_schema(fact).model_dump())
                        for key, fact in row.cells.items()
                    },
                )
                for row in result.rows
            ],
        )

    return router
