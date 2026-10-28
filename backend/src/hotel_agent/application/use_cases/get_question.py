from dataclasses import dataclass

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.question_records import question_from_record
from hotel_agent.domain.characteristics import FieldRule
from hotel_agent.domain.entities import HotelierQuestion
from hotel_agent.domain.errors import LinkSigningUnavailable, QuestionNotFound
from hotel_agent.domain.question_links import token_matches
from hotel_agent.domain.value_objects import QuestionId


@dataclass(frozen=True, slots=True, kw_only=True)
class QuestionDetail:
    question: HotelierQuestion
    hotel_name: str
    title: str
    fields: tuple[FieldRule, ...] = ()


class GetHotelierQuestion:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        registry: CharacteristicRegistryPort,
        secret: str = "",
    ) -> None:
        self._uow, self._registry, self._secret = uow, registry, secret

    async def __call__(self, question_id: str, token: str) -> QuestionDetail:
        if not self._secret:
            raise LinkSigningUnavailable()
        if not token_matches(QuestionId(question_id), token, self._secret):
            raise QuestionNotFound()
        async with self._uow() as uow:
            record = await uow.questions.get(question_id)
            if record is None:
                raise QuestionNotFound()
            hotel = await uow.search.get_hotel(record.hotel_id)
        characteristic = self._registry.get(record.characteristic_key)
        return QuestionDetail(
            question=question_from_record(record),
            hotel_name=hotel.name if hotel is not None else record.hotel_id,
            title=characteristic.title_ru,
            fields=characteristic.fields,
        )
