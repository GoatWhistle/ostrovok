from dataclasses import dataclass

from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record
from hotel_agent.application.use_cases.answer_question import (
    MAX_ANSWER_LENGTH,
    AnswerHotelierQuestion,
    AnswerResult,
)
from hotel_agent.domain.entities import QuestionStatus
from hotel_agent.domain.errors import HotelNotFound, InvalidValue


@dataclass(frozen=True, slots=True, kw_only=True)
class BatchAnswerResult:
    hotel_id: str
    applied: tuple[AnswerResult, ...] = ()
    untouched: tuple[str, ...] = ()


class AnswerHotelierQuestions:
    def __init__(
        self, uow: UnitOfWorkFactory, llm: LLMPort, answer: AnswerHotelierQuestion
    ) -> None:
        self._uow, self._llm, self._answer = uow, llm, answer

    async def __call__(self, hotel_id: str, text: str) -> BatchAnswerResult:
        if not text.strip() or len(text) > MAX_ANSWER_LENGTH:
            raise InvalidValue("Answer must contain between 1 and 10000 characters")
        async with self._uow() as uow:
            if await uow.search.get_hotel(hotel_id) is None:
                raise HotelNotFound()
            records = await uow.questions.for_hotel(hotel_id)
        open_questions = [
            question_from_record(record)
            for record in records
            if record.status == QuestionStatus.OPEN.value
        ]
        if not open_questions:
            raise InvalidValue("The hotel has no open questions")
        applied: list[AnswerResult] = []
        untouched: list[str] = []
        for question in open_questions:
            extraction = await self._llm.extract_fields(question.characteristic_key, text)
            if not extraction.fields:
                untouched.append(str(question.id))
                continue
            applied.append(await self._answer(str(question.id), text, extraction))
        return BatchAnswerResult(
            hotel_id=hotel_id, applied=tuple(applied), untouched=tuple(untouched)
        )
