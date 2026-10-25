from uuid import UUID

from fastapi import APIRouter

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.interfaces.http.chat_schemas import (
    ChatRequestSchema,
    ConversationSchema,
    conversation_schema,
)


def build_router(chat: Chat, registry: CharacteristicRegistryPort) -> APIRouter:
    router = APIRouter(tags=["chat"])

    @router.get("/chat/conversations/{conversation_id}", response_model=ConversationSchema)
    async def get_conversation(conversation_id: UUID) -> ConversationSchema:
        return conversation_schema(await chat.get(str(conversation_id)), registry)

    @router.post("/chat/messages", response_model=ConversationSchema)
    async def send_message(request: ChatRequestSchema) -> ConversationSchema:
        return conversation_schema(
            await chat.send(
                str(request.conversation_id) if request.conversation_id else None,
                request.message,
                request.region_id,
                request.selected_hotel_id,
                request.locale,
            ),
            registry,
        )

    return router
