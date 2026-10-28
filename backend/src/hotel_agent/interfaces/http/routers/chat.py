import asyncio
import json
from collections.abc import AsyncIterator
from http import HTTPStatus
from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Response, status
from fastapi.responses import StreamingResponse

from hotel_agent.application import progress
from hotel_agent.application.place_names import localized_place
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.domain.errors import DomainError
from hotel_agent.interfaces.http.chat_schemas import (
    ChatRequestSchema,
    ConversationSchema,
    ConversationTitleSchema,
    conversation_schema,
)
from hotel_agent.interfaces.http.errors import STATUS_BY_ERROR

Event = tuple[str, dict[str, object]]


def localized_fields(fields: dict[str, object], locale: str) -> dict[str, object]:
    location = fields.get("location")
    if not isinstance(location, str):
        return fields
    return {**fields, "location": localized_place(location, locale)}


def frame(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def failure(error: DomainError) -> dict[str, object]:
    mapped = next(
        (STATUS_BY_ERROR[kind] for kind in type(error).__mro__ if kind in STATUS_BY_ERROR), None
    )
    if mapped is None or mapped >= HTTPStatus.INTERNAL_SERVER_ERROR:
        return {"code": error.code, "message": type(error).message}
    return {"code": error.code, "message": error.message}


async def conversation_events(
    chat: Chat, registry: CharacteristicRegistryPort, request: ChatRequestSchema
) -> AsyncIterator[str]:
    queue: asyncio.Queue[Event | None] = asyncio.Queue()

    async def run() -> ConversationSchema:
        token = progress.listen(lambda stage, fields: queue.put_nowait((stage, fields)))
        started = perf_counter()
        try:
            outcome = await chat.send(
                str(request.conversation_id) if request.conversation_id else None,
                request.message,
                request.region_id,
                request.selected_hotel_id,
                request.locale,
            )
            return conversation_schema(outcome, registry, round((perf_counter() - started) * 1000))
        finally:
            progress.release(token)
            queue.put_nowait(None)

    answer = asyncio.create_task(run())
    while True:
        item = await queue.get()
        if item is None:
            break
        stage, fields = item
        yield frame("progress", {"stage": stage, **localized_fields(fields, request.locale)})
    try:
        yield frame("result", (await answer).model_dump(mode="json"))
    except DomainError as error:
        yield frame("error", failure(error))
    except Exception:
        yield frame("error", {"code": "internal_error", "message": "Internal error"})
        raise


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
        started = perf_counter()
        outcome = await chat.send(
            str(request.conversation_id) if request.conversation_id else None,
            request.message,
            request.region_id,
            request.selected_hotel_id,
            request.locale,
        )
        return conversation_schema(outcome, registry, round((perf_counter() - started) * 1000))

    @router.post("/chat/messages/stream", response_class=StreamingResponse)
    async def stream_message(request: ChatRequestSchema) -> StreamingResponse:
        return StreamingResponse(
            conversation_events(chat, registry, request),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    return router
