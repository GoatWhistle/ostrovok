from typing import Annotated

from fastapi import APIRouter, Query

from hotel_agent.application.use_cases.answer_question import AnswerHotelierQuestion
from hotel_agent.application.use_cases.answer_questions import AnswerHotelierQuestions
from hotel_agent.application.use_cases.change_facts import ChangeFacts
from hotel_agent.application.use_cases.get_question import GetHotelierQuestion
from hotel_agent.application.use_cases.hotelier_cabinet import GetHotelierCabinet
from hotel_agent.application.use_cases.hotelier_notifications import (
    DEFAULT_PAGE,
    ListHotelierNotifications,
    MarkNotificationsRead,
)
from hotel_agent.application.use_cases.hotelier_questions import (
    ChangeQuestionStatus,
    ListHotelierQuestions,
)
from hotel_agent.application.use_cases.state_fact import StateHotelierFact
from hotel_agent.domain.entities import QuestionStatus
from hotel_agent.interfaces.http.cabinet_schemas import (
    BatchAnswerSchema,
    HotelierNotificationFeedSchema,
    HotelierOverviewSchema,
    ReadNotificationsInput,
    ReadNotificationsSchema,
    StatedFactSchema,
    StatementInput,
    batch_answer_schema,
    counters_schema,
    feed_schema,
    overview_schema,
    stated_fact_schema,
)
from hotel_agent.interfaces.http.fact_schemas import FactSchema, fact_schema
from hotel_agent.interfaces.http.hotelier_schemas import (
    AnswerInput,
    AnswerResponseSchema,
    CorrectionInput,
    QuestionAnswerInput,
    QuestionDetailSchema,
    QuestionListSchema,
    QuestionSchema,
    QuestionStatusInput,
    answer_schema,
    question_detail_schema,
    question_schema,
)


def build_router(
    list_questions: ListHotelierQuestions,
    answer_question: AnswerHotelierQuestion,
    change_status: ChangeQuestionStatus,
    change_facts: ChangeFacts,
    cabinet: GetHotelierCabinet,
    list_notifications: ListHotelierNotifications,
    read_notifications: MarkNotificationsRead,
    answer_questions: AnswerHotelierQuestions,
    state_fact: StateHotelierFact,
    get_question: GetHotelierQuestion,
) -> APIRouter:
    router = APIRouter(tags=["hotelier"])

    @router.get("/hotelier/{hotel_id}/questions", response_model=QuestionListSchema)
    async def questions(
        hotel_id: str, status: Annotated[QuestionStatus | None, Query()] = None
    ) -> QuestionListSchema:
        return QuestionListSchema(
            items=[question_schema(item) for item in await list_questions(hotel_id, status)]
        )

    @router.get("/hotelier/{hotel_id}/overview", response_model=HotelierOverviewSchema)
    async def overview(hotel_id: str) -> HotelierOverviewSchema:
        return overview_schema(await cabinet(hotel_id))

    @router.get("/hotelier/{hotel_id}/notifications", response_model=HotelierNotificationFeedSchema)
    async def notifications(
        hotel_id: str,
        unread_only: Annotated[bool, Query()] = False,
        cursor: Annotated[str | None, Query()] = None,
        limit: Annotated[int, Query(ge=1, le=100)] = DEFAULT_PAGE,
    ) -> HotelierNotificationFeedSchema:
        return feed_schema(await list_notifications(hotel_id, unread_only, cursor, limit))

    @router.post("/hotelier/{hotel_id}/notifications/read", response_model=ReadNotificationsSchema)
    async def read(
        hotel_id: str, body: ReadNotificationsInput | None = None
    ) -> ReadNotificationsSchema:
        changed = await read_notifications(hotel_id, body.ids if body else None)
        feed = await list_notifications(hotel_id, limit=1)
        return ReadNotificationsSchema(read=changed, unread=counters_schema(feed.unread))

    @router.post("/hotelier/{hotel_id}/facts", response_model=StatedFactSchema)
    async def state(hotel_id: str, body: StatementInput) -> StatedFactSchema:
        return stated_fact_schema(await state_fact(hotel_id, body.characteristic_key, body.text))

    @router.post("/hotelier/{hotel_id}/answers", response_model=BatchAnswerSchema)
    async def answers(hotel_id: str, body: AnswerInput) -> BatchAnswerSchema:
        return batch_answer_schema(await answer_questions(hotel_id, body.text))

    @router.get("/hotelier/questions/{question_id}", response_model=QuestionDetailSchema)
    async def question(
        question_id: str, token: Annotated[str, Query(min_length=8, max_length=64)]
    ) -> QuestionDetailSchema:
        return question_detail_schema(await get_question(question_id, token))

    @router.post(
        "/hotelier/questions/{question_id}/answer",
        response_model=AnswerResponseSchema,
        response_model_exclude_unset=True,
    )
    async def answer(question_id: str, body: QuestionAnswerInput) -> dict[str, object]:
        return answer_schema(await answer_question(question_id, body.text, fields=body.fields))

    @router.patch("/hotelier/questions/{question_id}", response_model=QuestionSchema)
    async def status(question_id: str, body: QuestionStatusInput) -> QuestionSchema:
        return question_schema(await change_status(question_id, QuestionStatus(body.status)))

    @router.post("/facts/{fact_id}/confirm", response_model=FactSchema)
    async def confirm(fact_id: str) -> FactSchema:
        return fact_schema(await change_facts.confirm(fact_id))

    @router.post("/facts/{fact_id}/correct", response_model=FactSchema)
    async def correct(fact_id: str, body: CorrectionInput) -> FactSchema:
        return fact_schema(await change_facts.correct(fact_id, body.value, body.comment))

    return router
