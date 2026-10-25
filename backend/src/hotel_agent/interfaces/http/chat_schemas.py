from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import ConversationOutcome
from hotel_agent.interfaces.http.search_schemas import SearchResponseSchema, search_schema


class ChatRequestSchema(BaseModel):
    conversation_id: UUID | None = None
    message: str = Field(min_length=1, max_length=2000)
    region_id: str = "russia"
    selected_hotel_id: str | None = None
    locale: Literal["ru", "en"] = "ru"


class ChatMessageSchema(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime


class ConversationSchema(BaseModel):
    id: UUID
    messages: list[ChatMessageSchema]
    effective_query: str | None = None
    search: SearchResponseSchema | None = None


def conversation_schema(
    outcome: ConversationOutcome, registry: CharacteristicRegistryPort
) -> ConversationSchema:
    conversation = outcome.conversation
    return ConversationSchema(
        id=UUID(conversation.id),
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
        search=(
            SearchResponseSchema.model_validate(outcome.search_snapshot)
            if outcome.search_snapshot is not None
            else search_schema(outcome.search, registry, 0)
            if outcome.search
            else None
        ),
    )
