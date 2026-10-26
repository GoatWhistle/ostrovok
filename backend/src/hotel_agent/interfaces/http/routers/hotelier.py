from fastapi import APIRouter

from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.hotelier_questions import ListHotelierQuestions
from hotel_agent.interfaces.http.fact_schemas import FactSchema, fact_schema
from hotel_agent.interfaces.http.hotelier_schemas import (
    AnswerInput,
    AnswerResponseSchema,
    CorrectionInput,
    QuestionListSchema,
    answer_schema,
    question_schema,
)


def build_router(
    list_questions: ListHotelierQuestions,
    answer_question: AnswerHotelierQuestion,
    change_facts: ChangeFacts,
) -> APIRouter:
    router = APIRouter(tags=["hotelier"])

    @router.get("/hotelier/{hotel_id}/questions", response_model=QuestionListSchema)
    async def questions(hotel_id: str) -> QuestionListSchema:
        return QuestionListSchema(
            items=[question_schema(item) for item in await list_questions(hotel_id)]
        )

    @router.post(
        "/hotelier/questions/{question_id}/answer",
        response_model=AnswerResponseSchema,
        response_model_exclude_unset=True,
    )
    async def answer(question_id: str, body: AnswerInput) -> dict[str, object]:
        return answer_schema(await answer_question(question_id, body.text))

    @router.post("/facts/{fact_id}/confirm", response_model=FactSchema)
    async def confirm(fact_id: str) -> FactSchema:
        return fact_schema(await change_facts.confirm(fact_id))

    @router.post("/facts/{fact_id}/correct", response_model=FactSchema)
    async def correct(fact_id: str, body: CorrectionInput) -> FactSchema:
        return fact_schema(await change_facts.correct(fact_id, body.value, body.comment))

    return router
