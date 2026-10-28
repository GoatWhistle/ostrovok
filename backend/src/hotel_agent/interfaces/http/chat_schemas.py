from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import ConversationOutcome
from hotel_agent.domain.filters import FilterKind, SearchFilter
from hotel_agent.interfaces.http.search_schemas import SearchResponseSchema, search_schema


class ChatFilterSchema(BaseModel):
    kind: FilterKind
    label: str = ""
    key: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    adults: int | None = None


def chat_filter(item: ChatFilterSchema) -> SearchFilter:
    return SearchFilter(
        kind=item.kind,
        label=item.label.strip(),
        key=item.key,
        check_in=item.check_in,
        check_out=item.check_out,
        adults=item.adults,
    )


class ChatRequestSchema(BaseModel):
    conversation_id: UUID | None = None
    message: str = Field(max_length=2000)
    filters: list[ChatFilterSchema] | None = None
    region_id: str = "russia"
    selected_hotel_id: str | None = None
    locale: Literal["ru", "en"] = "ru"


class ChatMessageSchema(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime


class ConversationTitleSchema(BaseModel):
    title: str


class ConversationSchema(BaseModel):
    id: UUID
    title: str | None = None
    updated_at: datetime | None = None
    messages: list[ChatMessageSchema]
    effective_query: str | None = None
    filters: list[ChatFilterSchema] = Field(default_factory=list)
    search: SearchResponseSchema | None = None
    search_message_id: UUID | None = None


def conversation_schema(
    outcome: ConversationOutcome, registry: CharacteristicRegistryPort, took_ms: int = 0
) -> ConversationSchema:
    conversation = outcome.conversation
    return ConversationSchema(
        id=UUID(conversation.id),
        title=conversation.title,
        updated_at=conversation.updated_at,
        messages=[
            ChatMessageSchema(
                id=UUID(item.id),
                role=item.role,
                content=item.content,
                created_at=item.created_at,
            )
            for item in conversation.messages
        ],
        effective_query=conversation.effective_query,
        filters=[
            ChatFilterSchema(
                kind=item.kind,
                label=item.label,
                key=item.key,
                check_in=item.check_in,
                check_out=item.check_out,
                adults=item.adults,
            )
            for item in outcome.filters
        ],
        search_message_id=(
            UUID(str(conversation.search_snapshot["_chat_message_id"]))
            if conversation.search_snapshot and conversation.search_snapshot.get("_chat_message_id")
            else next(
                (UUID(m.id) for m in reversed(conversation.messages) if m.role == "assistant"), None
            )
            if conversation.search_snapshot is not None
            else None
        ),
        search=(
            SearchResponseSchema.model_validate(outcome.search_snapshot)
            if outcome.search_snapshot is not None
            else search_schema(outcome.search, registry, took_ms)
            if outcome.search
            else None
        ),
    )
