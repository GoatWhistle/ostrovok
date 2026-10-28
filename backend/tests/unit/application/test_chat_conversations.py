import json
from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Self, cast

import pytest

from hotel_agent.application.chat_records import ChatMessageRecord, ConversationRecord
from hotel_agent.application.dto import RegionRecord
from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import SearchHotels, SearchOutcome
from hotel_agent.domain.characteristics import Characteristic, Op
from hotel_agent.domain.errors import (
    ConversationNotFound,
    InvalidConversationTitle,
    UnknownCharacteristic,
)
from hotel_agent.domain.query import Intent, ParsedQuery

NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


@dataclass
class FakeChatRepository:
    conversations: dict[str, ConversationRecord] = field(default_factory=dict)

    async def get(self, conversation_id: str) -> ConversationRecord | None:
        return self.conversations.get(conversation_id)

    async def save(
        self,
        conversation_id: str,
        region_id: str,
        effective_query: str | None,
        user_message_id: str,
        user_text: str,
        answer_id: str,
        answer: str,
        search_snapshot: dict[str, object] | None,
        title: str | None = None,
    ) -> None:
        previous = self.conversations.get(conversation_id)
        messages = (
            ChatMessageRecord(id=user_message_id, role="user", content=user_text, created_at=NOW),
            ChatMessageRecord(id=answer_id, role="assistant", content=answer, created_at=NOW),
        )
        self.conversations[conversation_id] = ConversationRecord(
            id=conversation_id,
            region_id=region_id,
            effective_query=effective_query,
            messages=(previous.messages if previous else ()) + messages,
            search_snapshot=search_snapshot,
            title=previous.title if previous else title,
            updated_at=NOW,
        )

    async def save_search_snapshot(
        self, conversation_id: str, search_snapshot: dict[str, object]
    ) -> None:
        return None

    async def rename(self, conversation_id: str, title: str) -> bool:
        previous = self.conversations.get(conversation_id)
        if previous is None:
            return False
        self.conversations[conversation_id] = replace(previous, title=title, updated_at=NOW)
        return True

    async def delete(self, conversation_id: str) -> bool:
        return self.conversations.pop(conversation_id, None) is not None


class FakeRegions:
    async def list_loaded(self) -> list[RegionRecord]:
        return [
            RegionRecord(
                id=name,
                name=name,
                bbox=(19.0, 41.0, 180.0, 82.0),
                hotels_count=1,
                data_as_of=NOW.date(),
            )
            for name in ("russia", "sochi")
        ]


@dataclass
class FakeUnitOfWork:
    chat: FakeChatRepository
    commits: list[bool]
    regions: FakeRegions = field(default_factory=FakeRegions)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def commit(self) -> None:
        self.commits.append(True)


class FakeLLM:
    async def respond_to_chat(self, context: str) -> ChatDecision:
        data = json.loads(context)
        previous, message = data["previous_search_query"], data["message"]
        return ChatDecision(ChatMode.SEARCH, query=f"{previous} {message}" if previous else message)


class FakeSearch:
    def __init__(self, parsed: ParsedQuery) -> None:
        self.parsed = parsed

    async def __call__(
        self, query: str, region_id: str, user_id: str | None, limit: int
    ) -> SearchOutcome:
        return SearchOutcome(query_id="q", parsed=self.parsed, results=())


class FakeRegistry:
    def all(self) -> Sequence[Characteristic]:
        return ()

    def get(self, key: str) -> Characteristic:
        if key != "sunset_view":
            raise UnknownCharacteristic()
        return cast(Characteristic, SimpleNamespace(key=key, title_ru="Вид на закат"))


@dataclass
class Harness:
    chat: Chat
    repository: FakeChatRepository
    search: FakeSearch
    commits: list[bool]


def build(parsed: ParsedQuery) -> Harness:
    repository = FakeChatRepository()
    search = FakeSearch(parsed)
    commits: list[bool] = []
    chat = Chat(
        cast(LLMPort, FakeLLM()),
        cast(UnitOfWorkFactory, lambda: FakeUnitOfWork(repository, commits)),
        cast(SearchHotels, search),
        lambda outcome, _took: {"query_id": outcome.query_id},
        cast(CharacteristicRegistryPort, FakeRegistry()),
    )
    return Harness(chat=chat, repository=repository, search=search, commits=commits)


SUNSET = Intent(
    characteristic_key="sunset_view",
    op=Op.EQ,
    value=True,
    weight=1.0,
    required=False,
    source_text="с видом на закат",
)
PARSED = ParsedQuery(intents=(SUNSET,), unmatched_terms=(), location_hint="Сочи")


async def test_first_message_titles_the_conversation_and_follow_ups_keep_it() -> None:
    harness = build(PARSED)

    created = await harness.chat.send(None, "номер с видом на закат в Сочи", "russia", None)
    harness.search.parsed = replace(PARSED, location_hint="Адлер")
    followed = await harness.chat.send(created.conversation.id, "а в Адлере?", "russia", None)

    assert created.conversation.title == "Сочи: с видом на закат"
    assert followed.conversation.title == "Сочи: с видом на закат"
    assert len(harness.repository.conversations[created.conversation.id].messages) == 4


async def test_renamed_title_survives_follow_up_messages() -> None:
    chat = build(PARSED).chat
    created = await chat.send(None, "закат", "russia", None)

    renamed = await chat.rename(created.conversation.id, "  Отпуск   в октябре ")
    followed = await chat.send(created.conversation.id, "ещё тише", "russia", None)

    assert renamed.conversation.title == "Отпуск в октябре"
    assert renamed.conversation.updated_at == NOW
    assert renamed.search_snapshot is not None
    assert renamed.search_snapshot["query_id"] == "q"
    assert followed.conversation.title == "Отпуск в октябре"


async def test_invalid_title_is_rejected_without_writing() -> None:
    harness = build(PARSED)
    created = await harness.chat.send(None, "закат", "russia", None)
    harness.commits.clear()

    with pytest.raises(InvalidConversationTitle):
        await harness.chat.rename(created.conversation.id, "   ")

    assert harness.commits == []
    assert (
        harness.repository.conversations[created.conversation.id].title == "Сочи: с видом на закат"
    )


async def test_renaming_a_missing_conversation_is_not_found() -> None:
    chat = build(PARSED).chat

    with pytest.raises(ConversationNotFound):
        await chat.rename("missing", "Название")


async def test_delete_removes_the_conversation() -> None:
    harness = build(PARSED)
    created = await harness.chat.send(None, "закат", "russia", None)

    await harness.chat.delete(created.conversation.id)

    assert created.conversation.id not in harness.repository.conversations
    with pytest.raises(ConversationNotFound):
        await harness.chat.get(created.conversation.id)


async def test_deleting_a_missing_conversation_is_not_found() -> None:
    chat = build(PARSED).chat

    with pytest.raises(ConversationNotFound):
        await chat.delete("missing")
