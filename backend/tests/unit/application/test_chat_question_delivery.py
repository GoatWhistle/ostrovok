from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from tests.unit.application.test_chat_conversations import FakeChatRepository, FakeUnitOfWork
from tests.unit.application.test_research_tools import HOTEL


class QuestionWork(FakeUnitOfWork):
    search: SimpleNamespace
    facts: SimpleNamespace
    questions: SimpleNamespace


async def test_hotel_question_is_delivered_without_restarting_search(
    characteristics_dir: Path,
) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    repo = FakeChatRepository()
    work = QuestionWork(repo, [])
    questions = SimpleNamespace(get=AsyncMock(return_value=None), add=AsyncMock(return_value=1))
    work.search = SimpleNamespace(get_hotel=AsyncMock(return_value=HOTEL))
    work.facts = SimpleNamespace(versions=AsyncMock(return_value=[]), lock_hotel=AsyncMock())
    work.questions = questions
    llm = SimpleNamespace(
        respond_to_chat=AsyncMock(
            return_value=ChatDecision(
                ChatMode.HOTEL, reply="No information", question_keys=("blackout_curtains",)
            )
        )
    )
    search = AsyncMock()
    chat = Chat(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, lambda: work),
        cast(SearchHotels, search),
        lambda outcome, took_ms: {},
        registry,
        clock=cast(ClockPort, SimpleNamespace(now=lambda: datetime(2026, 10, 28, tzinfo=UTC))),
    )
    result = await chat.send(None, "Are there blackout curtains?", "russia", str(HOTEL.id))
    record = questions.add.call_args.args[0][0]
    assert record.hotel_id == str(HOTEL.id)
    assert record.characteristic_key == "blackout_curtains"
    assert record.status == "open"
    assert "владельцу" in result.conversation.messages[-1].content
    search.assert_not_awaited()

    questions.get.return_value = record
    questions.add.reset_mock()
    await chat.send(result.conversation.id, "Are there blackout curtains?", "russia", str(HOTEL.id))
    questions.add.assert_not_awaited()
    work.facts.versions.return_value = [
        SimpleNamespace(status="confirmed_by_hotelier", confidence=1.0, valid_until=None)
    ]
    questions.get.reset_mock()
    known = await chat.send(
        result.conversation.id, "Are there blackout curtains?", "russia", str(HOTEL.id)
    )
    questions.get.assert_not_awaited()
    assert "владельцу" not in known.conversation.messages[-1].content
    search.assert_not_awaited()
