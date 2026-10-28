from collections.abc import Callable, Sequence
from dataclasses import dataclass
from time import perf_counter
from uuid import uuid4

from hotel_agent.application import progress
from hotel_agent.application.agent.chat_answer_review import ChatAnswerReview
from hotel_agent.application.anywhere_request import keep_anywhere
from hotel_agent.application.chat_dialogue import ChatDialogue
from hotel_agent.application.chat_filters import filters_of, filters_of_snapshot, query_of
from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.conversation_titles import conversation_title, shorten, validated_title
from hotel_agent.application.ordinal_choice import chosen_hotel_id
from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.search_reply import fallback_reply, search_reply
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.errors import ConversationNotFound, InvalidQuery, RegionNotFound
from hotel_agent.domain.filters import SearchFilter


@dataclass(frozen=True, slots=True, kw_only=True)
class ConversationOutcome:
    conversation: ConversationRecord
    search: SearchOutcome | None
    search_snapshot: dict[str, object] | None = None
    filters: tuple[SearchFilter, ...] = ()


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
            conversation=conversation,
            search=None,
            search_snapshot=conversation.search_snapshot,
            filters=filters_of_snapshot(conversation.search_snapshot),
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
            conversation=conversation,
            search=None,
            search_snapshot=conversation.search_snapshot,
            filters=filters_of_snapshot(conversation.search_snapshot),
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
        filters: Sequence[SearchFilter] | None = None,
    ) -> ConversationOutcome:
        text = message.strip()
        requested = query_of(filters) if filters is not None else ""
        if not text and not requested:
            raise InvalidQuery("Chat message is empty")
        await self._known_region(region_id)
        previous = None
        if conversation_id:
            async with self._uow() as uow:
                previous = await uow.chat.get(conversation_id)
            if previous is None:
                raise ConversationNotFound()
            region_id = previous.region_id
        if text and selected_hotel_id is None and previous is not None:
            selected_hotel_id = chosen_hotel_id(text, previous.search_snapshot)
        if text:
            progress.mark("rewrite")
            decision = await self._dialogue.respond(
                previous, text, selected_hotel_id, locale, requested or None
            )
        else:
            decision = ChatDecision(ChatMode.SEARCH, query=requested)
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
            effective_query = keep_anywhere(text, decision.query)
            started = perf_counter()
            search = await self._search(effective_query, region_id, None, 20)
            took_ms = round((perf_counter() - started) * 1000)
            snapshot = {
                **self._serialize_search(search, took_ms),
                "_chat_message_id": answer_id,
            }
            progress.mark("answer")
            answer = self._answer(search, selected_hotel_id, locale)
            if self._review is not None and not await self._review.accepts(
                effective_query, answer, search
            ):
                answer = fallback_reply(search, locale)
        else:
            assert decision.reply is not None
            answer = decision.reply
        progress.mark("done")
        identifier = conversation_id or str(uuid4())
        title = (
            None
            if previous
            else (
                conversation_title(search.parsed, text or requested, locale, self._registry)
                if search
                else shorten(" ".join(text.split()), 60)
            )
        )
        async with self._uow() as uow:
            await uow.chat.save(
                identifier,
                region_id,
                effective_query,
                str(uuid4()),
                text or None,
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
            conversation=conversation,
            search=search,
            search_snapshot=snapshot,
            filters=filters_of(search.parsed) if search else filters_of_snapshot(snapshot),
        )

    async def _known_region(self, region_id: str) -> None:
        async with self._uow() as uow:
            loaded = await uow.regions.list_loaded()
        if not any(item.id == region_id for item in loaded):
            raise RegionNotFound()

    def _answer(self, search: SearchOutcome, selected_hotel_id: str | None, locale: str) -> str:
        return search_reply(search, selected_hotel_id, locale)
