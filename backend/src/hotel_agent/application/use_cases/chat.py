from dataclasses import dataclass
from uuid import uuid4

from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.errors import ConversationNotFound, InvalidQuery


@dataclass(frozen=True, slots=True, kw_only=True)
class ConversationOutcome:
    conversation: ConversationRecord
    search: SearchOutcome | None


class Chat:
    def __init__(self, llm: LLMPort, uow: UnitOfWorkFactory, search: SearchHotels) -> None:
        self._llm = llm
        self._uow = uow
        self._search = search

    async def get(self, conversation_id: str) -> ConversationOutcome:
        async with self._uow() as uow:
            conversation = await uow.chat.get(conversation_id)
        if conversation is None:
            raise ConversationNotFound()
        search = (
            await self._search(conversation.effective_query, conversation.region_id, None, 20)
            if conversation.effective_query
            else None
        )
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
            previous.effective_query if previous else None, message.strip()
        )
        search = await self._search(effective_query, region_id, None, 20)
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
                return "I could not find hotels with a verified match. Try changing the conditions."
            return (
                "Пока не нашёл отелей с подтверждённым совпадением. Уточните или измените условия."
            )
        if selected_hotel_id:
            selected = next(
                (item for item in search.results if item.hotel.id == selected_hotel_id), None
            )
            if selected:
                if locale == "en":
                    return f"I applied your update. {selected.hotel.name} remains in the list. Showing {count} hotels."
                return f"Учёл уточнение. «{selected.hotel.name}» остаётся в подборке. Показываю {count} отелей."
        names = ", ".join(item.hotel.name for item in search.results[:3])
        if locale == "en":
            return f"Showing {count} hotels. First in the list: {names}. Select a hotel to explore its surroundings."
        return f"Показываю {count} отелей. Первые в подборке: {names}. Выберите отель, чтобы изучить его и окружение."
