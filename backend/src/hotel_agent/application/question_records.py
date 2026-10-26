from hotel_agent.application.dto import QuestionRecord
from hotel_agent.domain.entities import HotelierQuestion, QuestionReason, QuestionStatus
from hotel_agent.domain.value_objects import HotelId, QuestionId


def question_from_record(record: QuestionRecord) -> HotelierQuestion:
    return HotelierQuestion(
        id=QuestionId(record.id),
        hotel_id=HotelId(record.hotel_id),
        characteristic_key=record.characteristic_key,
        text=record.text,
        reason=QuestionReason(record.reason),
        status=QuestionStatus(record.status),
        created_at=record.created_at,
    )


def question_to_record(question: HotelierQuestion) -> QuestionRecord:
    return QuestionRecord(
        id=str(question.id),
        hotel_id=str(question.hotel_id),
        characteristic_key=question.characteristic_key,
        text=question.text,
        reason=question.reason.value,
        status=question.status.value,
        created_at=question.created_at,
    )
