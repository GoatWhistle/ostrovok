from collections.abc import Callable
from dataclasses import dataclass
from uuid import uuid4

from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.errors import ConversationNotFound, InvalidQuery
from hotel_agent.domain.services.scoring import MatchQuality


@dataclass(frozen=True, slots=True, kw_only=True)
class ConversationOutcome:
    conversation: ConversationRecord
    search: SearchOutcome | None
    search_snapshot: dict[str, object] | None = None


class Chat:
    def __init__(
        self,
        llm: LLMPort,
        uow: UnitOfWorkFactory,
        search: SearchHotels,
        serialize_search: Callable[[SearchOutcome], dict[str, object]],
    ) -> None:
        self._llm = llm
        self._uow = uow
        self._search = search
        self._serialize_search = serialize_search

    async def get(self, conversation_id: str) -> ConversationOutcome:
        async with self._uow() as uow:
            conversation = await uow.chat.get(conversation_id)
        if conversation is None:
            raise ConversationNotFound()
        if conversation.search_snapshot is not None:
            return ConversationOutcome(
                conversation=conversation, search=None, search_snapshot=conversation.search_snapshot
            )
        search = (
            await self._search(conversation.effective_query, conversation.region_id, None, 20)
            if conversation.effective_query
            else None
        )
        if search is not None:
            snapshot = self._serialize_search(search)
            async with self._uow() as uow:
                await uow.chat.save_search_snapshot(conversation_id, snapshot)
                await uow.commit()
        return ConversationOutcome(conversation=conversation, search=search)

    async def send(
        self,
        conversation_id: str | None,
        message: str,
        region_id: str,
        selected_hotel_id: str | None,
        locale: str = "ru",
    ) -> ConversationOutcome:
        if not message.strip():
            raise InvalidQuery("Chat message is empty")
        previous = None
        if conversation_id:
            async with self._uow() as uow:
                previous = await uow.chat.get(conversation_id)
            if previous is None:
                raise ConversationNotFound()
            region_id = previous.region_id
        effective_query = await self._llm.contextualize_query(
            previous.effective_query if previous else None,
            message.strip(),
            tuple((item.role, item.content) for item in previous.messages[-8:]) if previous else (),
        )
        search = await self._search(effective_query, region_id, None, 20)
        snapshot = self._serialize_search(search)
        answer = self._answer(search, selected_hotel_id, locale)
        identifier = conversation_id or str(uuid4())
        async with self._uow() as uow:
            await uow.chat.save(
                identifier,
                region_id,
                effective_query,
                str(uuid4()),
                message.strip(),
                str(uuid4()),
                answer,
                snapshot,
            )
            await uow.commit()
        async with self._uow() as uow:
            conversation = await uow.chat.get(identifier)
        assert conversation is not None
        return ConversationOutcome(conversation=conversation, search=search)

    def _answer(self, search: SearchOutcome, selected_hotel_id: str | None, locale: str) -> str:
        if search.parsed.unsupported_region:
            if locale == "en":
                return f"Data for {search.parsed.unsupported_region} is not loaded yet."
            return f"Данные по региону «{search.parsed.unsupported_region}» пока не загружены."
        if search.parsed.needs_clarification:
            if locale == "en":
                return "Please clarify your request: some conditions conflict."
            return "Уточните условия: в запросе есть противоречие."
        count = len(search.results)
        if count == 0:
            if locale == "en":
                answer = (
                    "I could not find hotels with a verified match. Try changing the conditions."
                )
                return self._room_question(search, answer, locale)
            answer = (
                "Пока не нашёл отелей с подтверждённым совпадением. Уточните или измените условия."
            )
            return self._room_question(search, answer, locale)
        if selected_hotel_id:
            selected = next(
                (item for item in search.results if item.hotel.id == selected_hotel_id), None
            )
            if selected:
                if locale == "en":
                    answer = f"I applied your update. {selected.hotel.name} remains in the list. Showing {count} hotels."
                    return self._room_question(search, answer, locale)
                answer = f"Учёл уточнение. «{selected.hotel.name}» остаётся в подборке. Показываю {count} отелей."
                return self._room_question(search, answer, locale)
        names = ", ".join(item.hotel.name for item in search.results[:3])
        if locale == "en":
            answer = f"Showing {count} hotels. First in the list: {names}. Select a hotel to explore its surroundings."
            return self._room_question(search, answer, locale)
        answer = f"Показываю {count} отелей. Первые в подборке: {names}. Выберите отель, чтобы изучить его и окружение."
        return self._room_question(search, answer, locale)

    def _room_question(self, search: SearchOutcome, answer: str, locale: str) -> str:
        parsed = search.parsed
        if (
            parsed.intents
            and search.results
            and not any(
                all(match.quality is MatchQuality.FULL for match in result.scored.matches)
                for result in search.results
            )
        ):
            if locale == "en":
                answer += " No hotel has every condition verified; these are the closest matches."
            else:
                answer += (
                    " Ни у одного отеля не подтверждены все условия; это ближайшие совпадения."
                )
        if parsed.unmatched_terms:
            terms = ", ".join(parsed.unmatched_terms[:6])
            if locale == "en":
                answer += (
                    f" I could not verify: {terms}. These conditions did not affect the ranking."
                )
            else:
                answer += f" Не смог проверить: {terms}. Эти условия не учтены в подборке."
        if not parsed.wants_room:
            return answer
        missing = []
        if parsed.check_in is None:
            missing.append("check-in date" if locale == "en" else "дату заезда")
        if parsed.check_out is None:
            missing.append("check-out date" if locale == "en" else "дату выезда")
        if parsed.adults is None:
            missing.append("number of adults" if locale == "en" else "число взрослых")
        if not missing:
            return answer
        fields = ", ".join(missing)
        if locale == "en":
            return f"{answer} To check room availability, please tell me the {fields}."
        return f"{answer} Чтобы проверить свободные номера, уточните {fields}."
