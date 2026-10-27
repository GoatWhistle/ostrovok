from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record, question_to_record
from hotel_agent.domain.characteristics import Scope
from hotel_agent.domain.entities import HotelierQuestion, QuestionReason, QuestionStatus
from hotel_agent.domain.errors import HotelNotFound, InvalidValue, QuestionNotFound
from hotel_agent.domain.value_objects import HotelId, QuestionId


class ListHotelierQuestions:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, hotel_id: str) -> tuple[HotelierQuestion, ...]:
        async with self._uow() as uow:
            if await uow.search.get_hotel(hotel_id) is None:
                raise HotelNotFound()
            records = await uow.questions.for_hotel(hotel_id)
        return tuple(question_from_record(record) for record in records)


class ChangeQuestionStatus:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def __call__(self, question_id: str, status: QuestionStatus) -> HotelierQuestion:
        if status is QuestionStatus.ANSWERED:
            raise InvalidValue("A question is answered only through its answer")
        async with self._uow() as uow:
            record = await uow.questions.get(question_id, lock=True)
            if record is None:
                raise QuestionNotFound()
            current = question_from_record(record)
            changed = current.reopened() if status is QuestionStatus.OPEN else current.skipped()
            if changed.status is not current.status:
                await uow.questions.set_status(question_id, changed.status.value)
                await uow.commit()
        return changed


class PlanHotelierQuestions:
    def __init__(
        self, uow: UnitOfWorkFactory, registry: CharacteristicRegistryPort, clock: ClockPort
    ) -> None:
        self._uow, self._registry, self._clock = uow, registry, clock

    async def __call__(self, region: str) -> int:
        askable = {
            item.key: item
            for item in self._registry.all()
            if item.ask_hotelier_if_missing and item.scope is Scope.HOTEL
        }
        if not askable:
            return 0
        now = self._clock.now()
        async with self._uow() as uow:
            candidates = await uow.questions.candidates(region, sorted(askable))
            questions = [
                HotelierQuestion(
                    id=QuestionId(f"q_{item.hotel_id}_{item.characteristic_key}"),
                    hotel_id=HotelId(item.hotel_id),
                    characteristic_key=item.characteristic_key,
                    text=(
                        askable[item.characteristic_key].question_template
                        or askable[item.characteristic_key].title_ru
                    ).format(hotel=item.hotel_name),
                    reason=QuestionReason.MISSING,
                    created_at=now,
                )
                for item in candidates
            ]
            added = await uow.questions.add([question_to_record(item) for item in questions])
            await uow.commit()
        return added
