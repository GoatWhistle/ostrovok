from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from hotel_agent.application.use_cases.answer_question import AnswerResult
from hotel_agent.application.use_cases.get_fact import FactDetail
from hotel_agent.application.use_cases.get_question import QuestionDetail
from hotel_agent.domain.entities import HotelierQuestion
from hotel_agent.interfaces.http.fact_schemas import (
    ConflictSchema,
    FactDetailSchema,
    FactSchema,
    conflict_schema,
    fact_schema,
)


class QuestionSchema(BaseModel):
    id: str
    hotel_id: str
    characteristic_key: str
    text: str
    reason: Literal["missing", "conflict", "stale", "low_confidence"]
    status: Literal["open", "answered", "skipped"]
    created_at: datetime
    answer_text: str | None = None
    answered_at: datetime | None = None
    answer_fact_ids: list[str] = Field(default_factory=list)


class QuestionListSchema(BaseModel):
    items: list[QuestionSchema]


class AnswerInput(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)


class QuestionAnswerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(default="", max_length=10_000)
    fields: dict[str, bool | float | str | None] | None = None


class QuestionStatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["open", "skipped"]


class QuestionFieldSchema(BaseModel):
    name: str
    kind: Literal["bool", "number"]
    unit: str | None = None


class QuestionDetailSchema(BaseModel):
    question: QuestionSchema
    hotel_name: str
    title: str
    fields: list[QuestionFieldSchema] = Field(default_factory=list)


class AnswerResponseSchema(BaseModel):
    question_id: str
    extracted: list[FactSchema]
    conflicts: list[ConflictSchema]
    follow_up: QuestionSchema | None = None


class CorrectionInput(BaseModel):
    value: object = Field(...)
    comment: str = Field(default="", max_length=10_000)


def question_schema(question: HotelierQuestion) -> QuestionSchema:
    return QuestionSchema(
        id=str(question.id),
        hotel_id=str(question.hotel_id),
        characteristic_key=question.characteristic_key,
        text=question.text,
        reason=question.reason.value,
        status=question.status.value,
        created_at=question.created_at,
        answer_text=question.answer_text,
        answered_at=question.answered_at,
        answer_fact_ids=[str(item) for item in question.answer_fact_ids],
    )


def answer_schema(result: AnswerResult) -> dict[str, object]:
    body = AnswerResponseSchema(
        question_id=result.question_id,
        extracted=[fact_schema(item) for item in result.extracted],
        conflicts=[conflict_schema(item) for item in result.conflicts],
        follow_up=question_schema(result.follow_up) if result.follow_up else None,
    ).model_dump(mode="json")
    if body["follow_up"] is None:
        del body["follow_up"]
    return body


def fact_detail_schema(detail: FactDetail) -> FactDetailSchema:
    return FactDetailSchema.model_validate(
        {
            **fact_schema(detail.fact).model_dump(),
            "history": [fact_schema(item).model_dump() for item in detail.history],
            "conflicts": [conflict_schema(item).model_dump() for item in detail.conflicts],
        }
    )


def question_detail_schema(detail: QuestionDetail) -> QuestionDetailSchema:
    return QuestionDetailSchema(
        question=question_schema(detail.question),
        hotel_name=detail.hotel_name,
        title=detail.title,
        fields=[
            QuestionFieldSchema(
                name=rule.name,
                kind=rule.kind.value,
                unit=rule.units[0] if rule.units else None,
            )
            for rule in detail.fields
        ],
    )
