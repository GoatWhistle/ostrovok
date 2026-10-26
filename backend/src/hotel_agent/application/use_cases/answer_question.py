from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta

from hotel_agent.application.dto import ConflictRecord
from hotel_agent.application.fact_records import FactOwner, fact_to_record
from hotel_agent.application.fact_values import checked_value
from hotel_agent.application.fact_versions import conflict_record, current_versions, settle_answer
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import Extraction, LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWork, UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record
from hotel_agent.domain.characteristics import Characteristic, SourceType, ValueType
from hotel_agent.domain.entities import Fact, FactStatus, HotelierQuestion, QuestionStatus
from hotel_agent.domain.errors import InvalidValue, QuestionNotFound
from hotel_agent.domain.value_objects import (
    Confidence,
    ConflictId,
    Evidence,
    EvidenceKind,
    FactId,
    Provenance,
    SourceRef,
    Subject,
)

MAX_ANSWER_LENGTH = 10_000


@dataclass(frozen=True, slots=True, kw_only=True)
class AnswerResult:
    question_id: str
    extracted: tuple[Fact, ...] = ()
    conflicts: tuple[ConflictRecord, ...] = ()
    follow_up: HotelierQuestion | None = None


class AnswerHotelierQuestion:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        llm: LLMPort,
        clock: ClockPort,
        next_id: Callable[[str], str],
    ) -> None:
        self._uow, self._registry, self._llm = uow, registry, llm
        self._clock, self._next_id = clock, next_id

    async def __call__(self, question_id: str, text: str) -> AnswerResult:
        if not text.strip() or len(text) > MAX_ANSWER_LENGTH:
            raise InvalidValue("Answer must contain between 1 and 10000 characters")
        async with self._uow() as uow:
            question = await _open_question(uow, question_id, lock=False)
        characteristic = self._registry.get(question.characteristic_key)
        extraction = await self._llm.extract_fields(characteristic.key, text)
        values = {field.name: field.value for field in extraction.fields}
        if not values:
            async with self._uow() as uow:
                current = await _open_question(uow, question_id, lock=True)
                await uow.questions.record_answer(
                    question_id, QuestionStatus.OPEN.value, text, self._clock.now()
                )
                await uow.commit()
            return AnswerResult(question_id=question_id, follow_up=current)
        fact = self._fact(question, characteristic, extraction, text)
        owner = FactOwner.hotel(str(question.hotel_id))
        async with self._uow() as uow:
            await uow.facts.lock_hotel(owner.hotel_id)
            await _open_question(uow, question_id, lock=True)
            versions = await uow.facts.versions(
                owner.subject_type, owner.subject_id, characteristic.key
            )
            settlement = settle_answer(
                fact,
                current_versions(versions),
                self._clock.now(),
                characteristic.conflict_tolerance,
                ConflictId(self._next_id("c")),
            )
            await uow.facts.save([fact_to_record(item, owner) for item in settlement.writes])
            conflicts = (
                (conflict_record(settlement.conflict, owner),) if settlement.conflict else ()
            )
            await uow.facts.save_conflicts(conflicts)
            await uow.questions.record_answer(
                question_id, QuestionStatus.ANSWERED.value, text, self._clock.now()
            )
            await uow.commit()
        return AnswerResult(
            question_id=question_id, extracted=(settlement.fact,), conflicts=conflicts
        )

    def _fact(
        self,
        question: HotelierQuestion,
        characteristic: Characteristic,
        extraction: Extraction,
        text: str,
    ) -> Fact:
        values = {field.name: field.value for field in extraction.fields}
        value = checked_value(
            values
            if characteristic.value_type is ValueType.OBJECT
            else next(iter(values.values())),
            characteristic.value_type,
        )
        now = self._clock.now()
        return Fact(
            id=FactId(self._next_id("f")),
            subject=Subject.hotel(question.hotel_id),
            characteristic_key=characteristic.key,
            value=value,
            unit=characteristic.unit,
            qualifiers={
                key: item
                for key, item in values.items()
                if key not in ("allowed", "present") and item is not None
            }
            if characteristic.value_type is ValueType.OBJECT
            else {},
            status=FactStatus.CONFIRMED_BY_HOTELIER,
            explanation=text,
            provenance=Provenance(
                source=SourceRef(source_type=SourceType.HOTELIER, ref=str(question.id)),
                method="hotelier_answer@1",
                confidence=Confidence(1),
                computed_at=now,
                observed_at=now,
                valid_until=now + timedelta(days=characteristic.ttl_days),
                evidence=tuple(
                    Evidence(kind=EvidenceKind.QUOTE, text=item.quote) for item in extraction.fields
                ),
            ),
        )


async def _open_question(uow: UnitOfWork, question_id: str, lock: bool) -> HotelierQuestion:
    record = await uow.questions.get(question_id, lock=lock)
    if record is None:
        raise QuestionNotFound()
    question = question_from_record(record)
    if question.status is not QuestionStatus.OPEN:
        raise InvalidValue("Question has already been answered")
    return question
