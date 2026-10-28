from collections.abc import Callable
from dataclasses import dataclass
from time import perf_counter
from uuid import uuid4

from hotel_agent.application.agent.chat_answer_review import ChatAnswerReview, safe_answer
from hotel_agent.application.chat_dialogue import ChatDialogue
from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.conversation_titles import conversation_title, shorten, validated_title
from hotel_agent.application.ports.chat_dialogue import ChatMode
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.search_reply import search_reply
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.errors import ConversationNotFound, InvalidQuery, RegionNotFound


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
        serialize_search: Callable[[SearchOutcome, int], dict[str, object]],
        registry: CharacteristicRegistryPort,
        hotel_card: GetHotelCard | None = None,
        clock: ClockPort | None = None,
        review: ChatAnswerReview | None = None,
    ) -> None:
        self._review = review
        self._uow = uow
        self._search = search
        self._serialize_search = serialize_search
        self._registry = registry
        self._dialogue = ChatDialogue(llm, hotel_card, clock)

    async def get(self, conversation_id: str) -> ConversationOutcome:
        async with self._uow() as uow:
            conversation = await uow.chat.get(conversation_id)
        if conversation is None:
            raise ConversationNotFound()
        return ConversationOutcome(
            conversation=conversation, search=None, search_snapshot=conversation.search_snapshot
        )

    async def rename(self, conversation_id: str, title: str) -> ConversationOutcome:
        cleaned = validated_title(title)
        async with self._uow() as uow:
            renamed = await uow.chat.rename(conversation_id, cleaned)
            await uow.commit()
        if not renamed:
            raise ConversationNotFound()
        async with self._uow() as uow:
            conversation = await uow.chat.get(conversation_id)
        if conversation is None:
            raise ConversationNotFound()
        return ConversationOutcome(
            conversation=conversation, search=None, search_snapshot=conversation.search_snapshot
        )

    async def delete(self, conversation_id: str) -> None:
        async with self._uow() as uow:
            deleted = await uow.chat.delete(conversation_id)
            await uow.commit()
        if not deleted:
            raise ConversationNotFound()

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
        await self._known_region(region_id)
        previous = None
        if conversation_id:
            async with self._uow() as uow:
                previous = await uow.chat.get(conversation_id)
            if previous is None:
                raise ConversationNotFound()
            region_id = previous.region_id
        decision = await self._dialogue.respond(
            previous, message.strip(), selected_hotel_id, locale
        )
        search = None
        effective_query = previous.effective_query if previous else None
        snapshot = (
            dict(previous.search_snapshot)
            if previous and previous.search_snapshot is not None
            else None
        )
        if snapshot is not None and "_chat_message_id" not in snapshot and previous:
            snapshot["_chat_message_id"] = next(
                (m.id for m in reversed(previous.messages) if m.role == "assistant"), None
            )
        answer_id = str(uuid4())
        if decision.mode is ChatMode.SEARCH:
            assert decision.query is not None
            effective_query = decision.query
            started = perf_counter()
            search = await self._search(effective_query, region_id, None, 20)
            took_ms = round((perf_counter() - started) * 1000)
            snapshot = {
                **self._serialize_search(search, took_ms),
                "_chat_message_id": answer_id,
            }
            answer = self._answer(search, selected_hotel_id, locale)
            if self._review is not None and not await self._review.accepts(
                effective_query, answer, search
            ):
                answer = safe_answer(search, locale)
        else:
            assert decision.reply is not None
            answer = decision.reply
        identifier = conversation_id or str(uuid4())
        title = (
            None
            if previous
            else (
                conversation_title(search.parsed, message.strip(), locale, self._registry)
                if search
                else shorten(" ".join(message.split()), 60)
            )
        )
        async with self._uow() as uow:
            await uow.chat.save(
                identifier,
                region_id,
                effective_query,
                str(uuid4()),
                message.strip(),
                answer_id,
                answer,
                snapshot,
                title,
            )
            await uow.commit()
        async with self._uow() as uow:
            conversation = await uow.chat.get(identifier)
        assert conversation is not None
        return ConversationOutcome(
            conversation=conversation, search=search, search_snapshot=snapshot
        )

    async def _known_region(self, region_id: str) -> None:
        async with self._uow() as uow:
            loaded = await uow.regions.list_loaded()
        if not any(item.id == region_id for item in loaded):
            raise RegionNotFound()

    def _answer(self, search: SearchOutcome, selected_hotel_id: str | None, locale: str) -> str:
        return search_reply(search, selected_hotel_id, locale)
