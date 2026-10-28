from collections.abc import Callable
from dataclasses import dataclass

from hotel_agent.application import hotelier_events
from hotel_agent.application.dto import ConflictRecord
from hotel_agent.application.fact_records import FactOwner, fact_to_record
from hotel_agent.application.fact_versions import conflict_record, current_versions, settle_answer
from hotel_agent.application.hotelier_facts import hotelier_fact
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.answer_question import MAX_ANSWER_LENGTH
from hotel_agent.domain.characteristics import Scope, SourceType
from hotel_agent.domain.entities import Fact
from hotel_agent.domain.errors import HotelNotFound, InvalidValue
from hotel_agent.domain.value_objects import (
    ConflictId,
    FactId,
    HotelId,
    SourceRef,
    Subject,
)

METHOD = "hotelier_statement@1"


@dataclass(frozen=True, slots=True, kw_only=True)
class StatedFact:
    hotel_id: str
    fact: Fact
    conflicts: tuple[ConflictRecord, ...] = ()


class StateHotelierFact:
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

    async def __call__(self, hotel_id: str, characteristic_key: str, text: str) -> StatedFact:
        if not text.strip() or len(text) > MAX_ANSWER_LENGTH:
            raise InvalidValue("Statement must contain between 1 and 10000 characters")
        characteristic = self._registry.get(characteristic_key)
        if characteristic.scope is not Scope.HOTEL:
            raise InvalidValue("Only a hotel characteristic can be stated this way")
        async with self._uow() as uow:
            if await uow.search.get_hotel(hotel_id) is None:
                raise HotelNotFound()
        extraction = await self._llm.extract_fields(characteristic.key, text)
        if not extraction.fields:
            raise InvalidValue("No value could be read from the statement")
        fact = hotelier_fact(
            fact_id=FactId(self._next_id("f")),
            subject=Subject.hotel(HotelId(hotel_id)),
            characteristic=characteristic,
            extraction=extraction,
            text=text,
            method=METHOD,
            source=SourceRef(source_type=SourceType.HOTELIER),
            now=self._clock.now(),
        )
        owner = FactOwner.hotel(hotel_id)
        async with self._uow() as uow:
            await uow.facts.lock_hotel(hotel_id)
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
            await hotelier_events.announce(
                uow.notifications,
                hotelier_events.conflicts_raised(conflicts, hotel_id, self._clock.now()),
            )
            await uow.commit()
        return StatedFact(hotel_id=hotel_id, fact=settlement.fact, conflicts=conflicts)
