import json
from collections.abc import Mapping, Sequence
from typing import Any

from hotel_agent.adapters.llm import data_reasoning, prompts, text_evidence
from hotel_agent.adapters.llm.completion import Completion
from hotel_agent.adapters.llm.payload import (
    as_mapping,
    flag,
    items,
    number,
    scalar,
    text,
)
from hotel_agent.adapters.llm.query_payload import (
    parse_payload,
    plan_request,
    valid_intent_value,
)
from hotel_agent.adapters.llm.text import normalize
from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.ports.llm import (
    ExtractedField,
    Extraction,
    QuestionDraft,
    ToolCall,
)
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.characteristics import Characteristic, Op
from hotel_agent.domain.errors import ModelFailure, UnknownCharacteristic
from hotel_agent.domain.query import (
    Intent,
    ParsedQuery,
)


class StructuredLLM:
    def __init__(
        self,
        *,
        registry: CharacteristicRegistryPort,
        logger: LoggerPort,
        completion: Completion,
    ) -> None:
        self._registry = registry
        self._logger = logger
        self._completion = completion

    @property
    def provider(self) -> str:
        return self._completion.provider

    async def aclose(self) -> None:
        await self._completion.aclose()

    async def _complete(
        self, *, system: str, user: str, schema: dict[str, Any]
    ) -> Mapping[str, object]:
        return as_mapping(await self._completion.complete(system=system, user=user, schema=schema))

    async def _complete_text(self, *, system: str, user: str) -> str:
        result = await self._completion.complete(system=system, user=user)
        if not result.strip():
            raise ModelFailure("Language model returned an empty answer")
        return result.strip()

    async def contextualize_query(
        self,
        previous: str | None,
        message: str,
        history: Sequence[tuple[str, str]] = (),
    ) -> str:
        if previous is None:
            return message
        recent = "\n".join(f"{role}: {content}" for role, content in history[-8:])
        return await self._complete_text(
            system=(
                "Ты ведёшь диалог о поиске отеля. Верни только полный актуальный запрос для поиска. "
                "Сохрани прежние условия, если пользователь их не изменил. "
                "Согласие искать без города («мне не важен город», «где угодно») обязательно "
                "сохраняй в полном запросе, пока пользователь явно не ограничит место. "
                "Замени отменённые или исправленные условия; не добавляй новых. "
                "Если пользователь начинает новый поиск, используй только новый запрос. "
                "Учитывай историю беседы при разрешении ссылок вроде «он», «тот же» и «ещё». "
                "Ответы ассистента в истории не являются доказательством свойств отеля. "
                "Не утверждай факты об отелях."
            ),
            user=f"История беседы:\n{recent}\nАктуальные условия: {previous}\nНовое сообщение: {message}",
        )

    async def parse_query(self, query: str) -> ParsedQuery:
        registry = self._registry.all()
        payload = await self._complete(
            system=prompts.PARSE_QUERY_SYSTEM.format(catalog=prompts.catalog(registry)),
            user=query,
            schema=prompts.parse_query_schema(registry),
        )
        return parse_payload(payload, query, self._intent)

    async def explore_data(self, context: str) -> DataStep:
        raw = await self._completion.complete(
            system=data_reasoning.SYSTEM,
            user=context,
            schema=data_reasoning.schema(
                data_reasoning.observed_fields(context),
                finish_only=context.startswith("{")
                and json.loads(context).get("remaining_tool_calls") == 0,
            ),
            planning=True,
        )
        try:
            return data_reasoning.step(as_mapping(raw))
        except ModelFailure as error:
            self._logger.warning(
                "data_agent_invalid_response", detail=str(error), response_length=len(raw)
            )
            raise

    async def verify_evidence(self, context: str) -> Sequence[EvidenceVerdict]:
        raw = await self._completion.complete(
            system=text_evidence.instructions(context),
            user=context,
            schema=text_evidence.schema(),
        )
        payload = as_mapping(raw)
        return tuple(
            EvidenceVerdict(
                record_id=text(item, "record_id"),
                supported=flag(item, "supported"),
                quote=text(item, "quote"),
            )
            for item in items(payload, "verdicts")
        )

    async def plan_tools(
        self,
        query: ParsedQuery,
        subjects: Sequence[str],
        known: Mapping[str, Sequence[str]],
    ) -> Sequence[ToolCall]:
        registry = self._registry.all()
        payload = await self._complete(
            system=prompts.PLAN_TOOLS_SYSTEM.format(tools=prompts.tool_list(registry)),
            user=plan_request(query, subjects, known),
            schema=prompts.plan_tools_schema(registry),
        )
        allowed = set(subjects)
        calls = []
        for raw in items(payload, "calls"):
            key, subject = text(raw, "characteristic_key"), text(raw, "subject")
            if subject not in allowed or key in known.get(subject, ()):
                self._dropped("tool_call_outside_plan", key=key, subject=subject)
                continue
            if self._characteristic(key) is None:
                continue
            calls.append(ToolCall(characteristic_key=key, subject=subject))
        return calls

    async def formulate_question(
        self, characteristic_key: str, reason: str, hotel_name: str
    ) -> QuestionDraft:
        characteristic = self._registry.get(characteristic_key)
        template = characteristic.question_template or characteristic.title_ru
        text = await self._complete_text(
            system=prompts.QUESTION_SYSTEM,
            user=(
                f"Отель: {hotel_name}. Характеристика: {characteristic.title_ru}"
                f" ({characteristic.description}). Причина: {reason}."
                f" Образец формулировки: {template.replace('{hotel}', hotel_name)}"
            ),
        )
        return QuestionDraft(characteristic_key=characteristic_key, text=text)

    async def extract_fields(self, characteristic_key: str, answer: str) -> Extraction:
        characteristic = self._registry.get(characteristic_key)
        payload = await self._complete(
            system=prompts.EXTRACT_SYSTEM,
            user=f"Поля: {prompts.field_list(characteristic)}\nОтвет отельера: {answer}",
            schema=prompts.extract_fields_schema(characteristic),
        )
        declared = {rule.name for rule in characteristic.fields}
        grounded = normalize(answer)
        fields = []
        for raw in items(payload, "fields"):
            name, quote = text(raw, "name"), text(raw, "quote")
            if name not in declared:
                self._dropped("field_outside_registry", key=characteristic_key, field=name)
                continue
            if normalize(quote) not in grounded:
                self._dropped("quote_not_in_answer", key=characteristic_key, field=name)
                continue
            fields.append(ExtractedField(name=name, value=scalar(raw, "value"), quote=quote))
        return Extraction(characteristic_key=characteristic_key, fields=tuple(fields))

    def _intent(self, raw: Mapping[str, object], query: str) -> Intent | None:
        key = text(raw, "characteristic_key")
        characteristic = self._characteristic(key)
        if characteristic is None:
            return None
        try:
            op = Op(text(raw, "op"))
        except ValueError:
            self._dropped("unknown_operator", key=key, op=text(raw, "op"))
            return None
        source = text(raw, "source_text").strip()
        if not source or normalize(source) not in normalize(query):
            self._dropped("source_not_in_query", key=key)
            return None
        value = scalar(raw, "value")
        if not valid_intent_value(characteristic.value_type, value):
            self._dropped("invalid_intent_value", key=key)
            return None
        if key == "pets_policy" and not any(
            marker in normalize(source)
            for marker in ("питом", "собак", "кошк", "живот", "pet", "dog", "cat")
        ):
            self._dropped("ungrounded_pets_policy", key=key)
            return None
        return Intent(
            characteristic_key=key,
            op=op,
            value=value,
            weight=number(raw, "weight"),
            required=flag(raw, "required"),
            source_text=source,
        )

    def _characteristic(self, key: str) -> Characteristic | None:
        try:
            return self._registry.get(key)
        except UnknownCharacteristic:
            self._dropped("unknown_characteristic", key=key)
            return None

    def _dropped(self, event: str, **fields: str) -> None:
        self._logger.warning(f"llm_{event}", provider=self.provider, **fields)
