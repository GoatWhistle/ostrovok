import json
from collections.abc import Sequence

from hotel_agent.adapters.llm.query_instructions import PARSE_QUERY_SYSTEM
from hotel_agent.adapters.llm.response_schemas import (
    extract_fields_schema,
    parse_query_schema,
    plan_tools_schema,
)
from hotel_agent.domain.characteristics import Characteristic

__all__ = ["PARSE_QUERY_SYSTEM", "extract_fields_schema", "parse_query_schema", "plan_tools_schema"]


PLAN_TOOLS_SYSTEM = """\
Ты планируешь, какие характеристики досчитать для каких объектов.
Назначай вызов только если характеристика есть в запросе, у неё есть инструмент расчёта
и для этого объекта она ещё не известна. Ничего не вычисляй сам.

Характеристики с инструментом: {tools}"""

QUESTION_SYSTEM = """\
Ты пишешь один короткий вопрос отельеру на русском языке, чтобы уточнить характеристику.
Один вопрос, не более двух предложений, без приветствия и подписи.
Не предлагай вариантов ответа и ничего не утверждай о самом отеле."""

EXTRACT_SYSTEM = """\
Ты раскладываешь свободный ответ отельера по полям.
Заполняй только перечисленные поля и только если ответ прямо их называет.
quote — минимальный дословный фрагмент ответа, подтверждающий именно это значение:
обычно два-пять слов. Копируй символы как есть, не перефразируй, не исправляй опечатки
и не возвращай весь ответ целиком.
Поле, о котором в ответе ничего не сказано, просто не возвращай."""


def catalog(registry: Sequence[Characteristic]) -> str:
    lines = []
    for item in registry:
        unit = f", единица {item.unit}" if item.unit else ""
        lines.append(
            f"- {item.key}: {item.title_ru} ({item.value_type}{unit}, область {item.scope})."
        )
        if item.synonyms:
            lines.append(f"    синонимы: {', '.join(item.synonyms)}")
        for example in _examples(item):
            lines.append(f"    эталон: {example}")
    return "\n".join(lines)


def _examples(item: Characteristic) -> list[str]:
    return [
        f"{matcher.phrase!r} -> op={matcher.op.value} value={_literal(matcher.value)}"
        f" weight={matcher.weight} required={str(matcher.required).lower()}"
        for matcher in item.matchers
    ]


def _literal(value: object) -> str:
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return json.dumps(value, ensure_ascii=False)


def tool_list(registry: Sequence[Characteristic]) -> str:
    return ", ".join(item.key for item in registry if item.tool is not None) or "нет"


def field_list(characteristic: Characteristic) -> str:
    return json.dumps(
        [{"name": rule.name, "kind": rule.kind.value} for rule in characteristic.fields],
        ensure_ascii=False,
    )
