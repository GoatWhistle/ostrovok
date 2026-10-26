from uuid import UUID

from fastapi import APIRouter, Response, status

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.interfaces.http.chat_schemas import (
    ChatRequestSchema,
    ConversationSchema,
    ConversationTitleSchema,
    conversation_schema,
)


def build_router(chat: Chat, registry: CharacteristicRegistryPort) -> APIRouter:
    router = APIRouter(tags=["chat"])

    @router.get("/chat/conversations/{conversation_id}", response_model=ConversationSchema)
    async def get_conversation(conversation_id: UUID) -> ConversationSchema:
        return conversation_schema(await chat.get(str(conversation_id)), registry)

    @router.patch("/chat/conversations/{conversation_id}", response_model=ConversationSchema)
    async def rename_conversation(
        conversation_id: UUID, request: ConversationTitleSchema
    ) -> ConversationSchema:
        return conversation_schema(await chat.rename(str(conversation_id), request.title), registry)

    @router.delete(
        "/chat/conversations/{conversation_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        response_class=Response,
    )
    async def delete_conversation(conversation_id: UUID) -> Response:
        await chat.delete(str(conversation_id))
        return Response(status_code=status.HTTP_204_NO_CONTENT)

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
