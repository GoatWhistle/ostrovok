from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.conversation_titles import validated_title
from hotel_agent.application.ports.log import LogValue
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.chat import Chat, ConversationOutcome
from hotel_agent.domain.errors import ConversationNotFound
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.interfaces.http.routers.chat import build_router

CONVERSATION_ID = "0b6f3f5e-8f0e-4f2b-9d0a-6d8f3c1e2a10"
UPDATED_AT = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


class SilentLogger:
    def info(self, event: str, **fields: LogValue) -> None:
        return None

    def warning(self, event: str, **fields: LogValue) -> None:
        return None

    def error(self, event: str, *, exc: BaseException | None = None, **fields: LogValue) -> None:
        return None


async def rename(conversation_id: str, title: str) -> ConversationOutcome:
    record = ConversationRecord(
        id=conversation_id,
        region_id="russia",
        effective_query="закат",
        messages=(),
        title=validated_title(title),
        updated_at=UPDATED_AT,
    )
    return ConversationOutcome(conversation=record, search=None)


def client(chat: object) -> TestClient:
    app = FastAPI()
    ErrorHandlers(SilentLogger()).register(app)
    app.include_router(
        build_router(cast(Chat, chat), cast(CharacteristicRegistryPort, SimpleNamespace()))
    )
    return TestClient(app, raise_server_exceptions=False)


def test_patch_returns_the_renamed_conversation() -> None:
    response = client(SimpleNamespace(rename=rename)).patch(
        f"/chat/conversations/{CONVERSATION_ID}", json={"title": "  Отпуск  "}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Отпуск"
    assert body["updated_at"] == "2026-10-26T12:00:00Z"


def test_patch_rejects_a_blank_title() -> None:
    response = client(SimpleNamespace(rename=rename)).patch(
        f"/chat/conversations/{CONVERSATION_ID}", json={"title": "   "}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_title"


def test_delete_returns_no_content() -> None:
    delete = AsyncMock(return_value=None)

    response = client(SimpleNamespace(delete=delete)).delete(
        f"/chat/conversations/{CONVERSATION_ID}"
    )

    assert response.status_code == 204
    assert response.content == b""
    delete.assert_awaited_once_with(CONVERSATION_ID)


def test_delete_of_missing_conversation_is_not_found() -> None:
    delete = AsyncMock(side_effect=ConversationNotFound())

    response = client(SimpleNamespace(delete=delete)).delete(
        f"/chat/conversations/{CONVERSATION_ID}"
    )

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
