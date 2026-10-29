from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.owner_topics import owner_topics
from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.chat import Chat
from hotel_agent.application.use_cases.search_hotels import SearchHotels
from tests.unit.application.test_chat_conversations import FakeChatRepository, FakeUnitOfWork
from tests.unit.application.test_research_tools import HOTEL

NOW = datetime(2026, 10, 28, tzinfo=UTC)


class QuestionWork(FakeUnitOfWork):
    search: SimpleNamespace
    facts: SimpleNamespace
    questions: SimpleNamespace


def owner_fact(text: str) -> SimpleNamespace:
    return SimpleNamespace(
        status="confirmed_by_hotelier",
        confidence=1.0,
        valid_until=None,
        source_type="hotelier",
        explanation=text,
        observed_at=NOW,
        computed_at=NOW,
    )


def chat_with(
    characteristics_dir: Path, decision: ChatDecision
) -> tuple[Chat, QuestionWork, SimpleNamespace, AsyncMock]:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)
    work = QuestionWork(FakeChatRepository(), [])
    work.search = SimpleNamespace(get_hotel=AsyncMock(return_value=HOTEL))
    work.facts = SimpleNamespace(versions=AsyncMock(return_value=[]), lock_hotel=AsyncMock())
    work.questions = SimpleNamespace(
        get=AsyncMock(return_value=None), add=AsyncMock(return_value=1), follow=AsyncMock()
    )
    llm = SimpleNamespace(respond_to_chat=AsyncMock(return_value=decision))
    search = AsyncMock()
    chat = Chat(
        cast(LLMPort, llm),
        cast(UnitOfWorkFactory, lambda: work),
        cast(SearchHotels, search),
        lambda outcome, took_ms: {},
        registry,
        clock=cast(ClockPort, SimpleNamespace(now=lambda: NOW)),
    )
    return chat, work, llm, search


async def test_hotel_question_is_delivered_without_restarting_search(
    characteristics_dir: Path,
) -> None:
    chat, work, llm, search = chat_with(
        characteristics_dir,
        ChatDecision(ChatMode.HOTEL, reply="No information", question_keys=("blackout_curtains",)),
    )
    result = await chat.send(None, "Is it dark in the rooms at night?", "russia", str(HOTEL.id))
    record = work.questions.add.call_args.args[0][0]
    assert record.hotel_id == str(HOTEL.id)
    assert record.characteristic_key == "blackout_curtains"
    assert record.status == "open"
    assert "владельцу" in result.conversation.messages[-1].content
    llm.respond_to_chat.assert_awaited()
    search.assert_not_awaited()

    work.questions.get.return_value = record
    work.questions.add.reset_mock()
    await chat.send(
        result.conversation.id, "Is it dark in the rooms at night?", "russia", str(HOTEL.id)
    )
    work.questions.add.assert_not_awaited()
    work.facts.versions.return_value = [owner_fact("Blackout curtains in every room")]
    work.questions.get.reset_mock()
    known = await chat.send(
        result.conversation.id, "Is it dark in the rooms at night?", "russia", str(HOTEL.id)
    )
    reply = known.conversation.messages[-1].content
    work.questions.get.assert_not_awaited()
    assert "Вопрос отправлен" not in reply
    assert "Ответ владельца отеля от 28.10.2026: «Blackout curtains in every room»" in reply
    search.assert_not_awaited()


async def test_owner_topic_is_answered_without_the_model(characteristics_dir: Path) -> None:
    chat, work, llm, search = chat_with(
        characteristics_dir, ChatDecision(ChatMode.SEARCH, query="отель с собакой")
    )
    asked = await chat.send(None, "Можно ли заселиться с собакой?", "russia", str(HOTEL.id))
    reply = asked.conversation.messages[-1].content
    assert work.questions.add.call_args.args[0][0].characteristic_key == "pets_policy"
    assert reply.startswith("Таких данных об отеле пока нет. Передали ваш вопрос владельцу")
    work.questions.follow.assert_awaited_once_with(
        f"q_{HOTEL.id}_pets_policy", asked.conversation.id
    )

    work.questions.add.reset_mock()
    work.facts.versions.return_value = [owner_fact("Да, с собаками до 10 кг, 1000 ₽ за ночь")]
    known = await chat.send(
        asked.conversation.id, "А с собакой точно можно?", "russia", str(HOTEL.id)
    )
    assert known.conversation.messages[-1].content == (
        "Ответ владельца отеля от 28.10.2026: «Да, с собаками до 10 кг, 1000 ₽ за ночь»"
    )
    work.questions.add.assert_not_awaited()
    llm.respond_to_chat.assert_not_awaited()
    search.assert_not_awaited()


async def test_owner_topic_without_selected_hotel_goes_to_the_model(
    characteristics_dir: Path,
) -> None:
    chat, work, llm, _ = chat_with(
        characteristics_dir, ChatDecision(ChatMode.CONSULT, reply="Уточните отель")
    )
    await chat.send(None, "Можно ли с собакой?", "russia", None)
    llm.respond_to_chat.assert_awaited()
    work.questions.add.assert_not_awaited()


def test_owner_topics_skip_search_requests() -> None:
    assert owner_topics("Можно ли заселиться с собакой?") == ("pets_policy",)
    assert owner_topics("Есть ли шторы блэкаут и сколько взрослых в номере?") == (
        "blackout_curtains",
        "room_capacity",
    )
    assert owner_topics("Найди другой отель, где можно с собакой") == ()
    assert owner_topics("Is there a gym?") == ()
