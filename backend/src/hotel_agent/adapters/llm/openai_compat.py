import asyncio
from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from hotel_agent.adapters.llm import prompts
from hotel_agent.adapters.llm.payload import (
    as_mapping,
    content_of,
    flag,
    items,
    number,
    optional_text,
    scalar,
    strings,
    text,
)
from hotel_agent.adapters.llm.text import normalize
from hotel_agent.application.ports.llm import (
    ExtractedField,
    Extraction,
    QuestionDraft,
    ToolCall,
)
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.domain.characteristics import Characteristic, Op, ValueType
from hotel_agent.domain.errors import ModelFailure, UnknownCharacteristic
from hotel_agent.domain.query import (
    OSM_OBJECT_KEYS,
    Intent,
    NearbyObjectRequest,
    ParsedQuery,
    QueryCorrection,
)


class OpenAICompatLLM:
    def __init__(
        self,
        *,
        registry: CharacteristicRegistryPort,
        logger: LoggerPort,
        base_url: str,
        api_key: str,
        model: str,
        timeout_s: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._registry = registry
        self._logger = logger
        self._model = model
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_s,
            transport=transport,
        )

    @property
    def provider(self) -> str:
        return "openai_compat"

    async def contextualize_query(self, previous: str | None, message: str) -> str:
        if previous is None:
            return message
        return await self._complete_text(
            system=(
                "Ты ведёшь диалог о поиске отеля. Верни только полный актуальный запрос для поиска. "
                "Сохрани прежние условия, если пользователь их не изменил. "
                "Замени отменённые или исправленные условия; не добавляй новых. "
                "Если пользователь начинает новый поиск, используй только новый запрос. "
                "Не утверждай факты об отелях."
            ),
            user=f"Предыдущий запрос: {previous}\nНовое сообщение: {message}",
        )

    async def parse_query(self, query: str) -> ParsedQuery:
        registry = self._registry.all()
        payload = await self._complete(
            system=prompts.PARSE_QUERY_SYSTEM.format(catalog=prompts.catalog(registry)),
            user=query,
            schema=prompts.parse_query_schema(registry),
        )
        intents = tuple(
            intent
            for raw in items(payload, "intents")
            if (intent := self._intent(raw, query)) is not None
        )
        return ParsedQuery(
            intents=intents,
            unmatched_terms=tuple(strings(payload, "unmatched_terms")),
            location_hint=optional_text(payload, "location_hint"),
            nearby_objects=tuple(
                item
                for raw in items(payload, "nearby_objects")
                if (item := _nearby_object(raw, query)) is not None
            ),
            normalized_query=optional_text(payload, "normalized_query") or query,
            corrections=tuple(
                correction
                for raw in items(payload, "corrections")
                if (correction := _correction(raw, query)) is not None
            ),
            needs_clarification=flag(payload, "needs_clarification"),
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
            user=_plan_request(query, subjects, known),
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

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _complete(
        self, *, system: str, user: str, schema: dict[str, Any]
    ) -> Mapping[str, object]:
        body = await self._post(system=system, user=user, response_format=schema)
        return as_mapping(body)

    async def _complete_text(self, *, system: str, user: str) -> str:
        text = await self._post(system=system, user=user, response_format=None)
        if not text.strip():
            raise ModelFailure("Language model returned an empty answer")
        return text.strip()

    async def _post(self, *, system: str, user: str, response_format: dict[str, Any] | None) -> str:
        request: dict[str, Any] = {
            "model": self._model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if response_format is not None:
            request["response_format"] = response_format
        for attempt in range(2):
            try:
                response = await self._client.post("/chat/completions", json=request)
                response.raise_for_status()
                return content_of(response.json())
            except (httpx.ConnectError, httpx.ReadTimeout) as error:
                if attempt == 0:
                    self._logger.warning(
                        "llm_request_retry",
                        provider=self.provider,
                        cause=type(error).__name__,
                        response="structured" if response_format is not None else "text",
                    )
                    await asyncio.sleep(0.2)
                    continue
                raise ModelFailure(
                    f"Language model is unreachable: {type(error).__name__}"
                ) from error
            except httpx.HTTPStatusError as error:
                raise ModelFailure(
                    f"Language model returned HTTP {error.response.status_code}"
                ) from error
            except httpx.HTTPError as error:
                raise ModelFailure(
                    f"Language model is unreachable: {type(error).__name__}"
                ) from error
        raise ModelFailure("Language model is unreachable")

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
        if not _valid_intent_value(characteristic.value_type, value):
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


def _plan_request(
    query: ParsedQuery, subjects: Sequence[str], known: Mapping[str, Sequence[str]]
) -> str:
    wanted = ", ".join(intent.characteristic_key for intent in query.intents) or "нет"
    lines = [f"{subject}: {', '.join(known.get(subject, ())) or 'ничего'}" for subject in subjects]
    return f"Нужны характеристики: {wanted}\nУже известно по объектам:\n" + "\n".join(lines)


def _valid_intent_value(value_type: ValueType, value: object) -> bool:
    if value_type == ValueType.NUMBER:
        return isinstance(value, int | float) and not isinstance(value, bool)
    if value_type == ValueType.BOOL:
        return isinstance(value, bool)
    if value_type in {ValueType.ENUM, ValueType.TEXT}:
        return isinstance(value, str)
    return isinstance(value, bool | str | int | float)


def _nearby_object(raw: Mapping[str, object], query: str) -> NearbyObjectRequest | None:
    key = text(raw, "osm_key")
    value = text(raw, "osm_value").strip().lower()
    source = text(raw, "source_text").strip()
    if (
        key not in OSM_OBJECT_KEYS
        or not value
        or not source
        or normalize(source) not in normalize(query)
    ):
        return None
    radius = number(raw, "radius_m")
    return NearbyObjectRequest(
        osm_key=key,
        osm_value=value,
        open_24h=flag(raw, "open_24h"),
        radius_m=max(100, min(50000, int(radius or 500))),
        source_text=source,
    )


def _correction(raw: Mapping[str, object], query: str) -> QueryCorrection | None:
    original = text(raw, "original").strip()
    corrected = text(raw, "corrected").strip()
    reason = text(raw, "reason").strip()
    if not original or normalize(original) not in normalize(query) or not corrected or not reason:
        return None
    return QueryCorrection(original=original, corrected=corrected, reason=reason)
