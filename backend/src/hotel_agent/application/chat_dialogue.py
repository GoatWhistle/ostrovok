import json

from hotel_agent.application.chat_context import selected_hotel_context
from hotel_agent.application.chat_records import ConversationRecord
from hotel_agent.application.ports.chat_dialogue import ChatDecision, ChatMode
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.use_cases.get_hotel_card import GetHotelCard
from hotel_agent.domain.characteristics import SourceType
from hotel_agent.domain.errors import ModelFailure


class ChatDialogue:
    def __init__(
        self,
        llm: LLMPort,
        hotel_card: GetHotelCard | None,
        clock: ClockPort | None = None,
        registry: CharacteristicRegistryPort | None = None,
    ) -> None:
        self._llm, self._hotel_card, self._clock = llm, hotel_card, clock
        self._registry = registry

    async def respond(
        self,
        previous: ConversationRecord | None,
        message: str,
        selected_hotel_id: str | None,
        locale: str,
        conditions: str | None = None,
    ) -> ChatDecision:
        context = json.dumps(
            {
                "message": message,
                "now": self._clock.now().isoformat() if self._clock else None,
                "locale": locale,
                "previous_search_query": conditions
                if conditions
                else previous.effective_query
                if previous
                else None,
                "needs_city": needs_city(previous),
                "history": [{"role": m.role, "content": m.content} for m in previous.messages[-8:]]
                if previous
                else [],
                "selected_hotel": await selected_hotel_context(self._hotel_card, selected_hotel_id),
                "requestable_characteristics": [
                    {"key": item.key, "title": item.title_ru}
                    for item in self._registry.all()
                    if item.ask_hotelier_if_missing and SourceType.HOTELIER in item.source_kinds
                ]
                if self._registry
                else [],
            },
            ensure_ascii=False,
            default=str,
        )
        try:
            result = await self._llm.respond_to_chat(context)
            if result.mode is ChatMode.SEARCH:
                if not result.query or not result.query.strip() or result.reply is not None:
                    raise ModelFailure("Invalid search routing decision")
                return result
            if result.query is not None or not result.reply or not result.reply.strip():
                raise ModelFailure("Invalid consultation routing decision")
            if result.mode is ChatMode.HOTEL and not selected_hotel_id:
                return ChatDecision(
                    ChatMode.CONSULT,
                    reply=(
                        "Select a hotel so I can answer about it."
                        if locale == "en"
                        else "Выберите отель, чтобы я мог ответить о нём по данным карточки."
                    ),
                )
            return result
        except ModelFailure:
            return ChatDecision(
                ChatMode.CONSULT,
                reply=(
                    "Do you want me to find hotels, or would you like advice? Please clarify your question."
                    if locale == "en"
                    else "Вы хотите подобрать отели или получить совет? Уточните, пожалуйста, вопрос."
                ),
            )


def needs_city(previous: ConversationRecord | None) -> bool:
    snapshot = previous.search_snapshot if previous else None
    parsed = snapshot.get("parsed") if snapshot else None
    return (
        isinstance(parsed, dict)
        and bool(parsed.get("needs_clarification"))
        and not parsed.get("location_hint")
    )
