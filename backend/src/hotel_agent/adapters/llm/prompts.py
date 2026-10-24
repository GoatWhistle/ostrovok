import json
from collections.abc import Sequence
from typing import Any

from hotel_agent.domain.characteristics import Characteristic, Op

SCALAR = {"type": ["boolean", "number", "string", "null"]}

PARSE_QUERY_SYSTEM = """\
Ты разбираешь поисковый запрос по отелям на интенты.

Правила:
1. Бери характеристики только из списка ниже, операторы — только из перечня эталонов.
2. Для каждой характеристики ориентируйся на её эталоны: подбирай ближайший по смыслу
   и повторяй его оператор и порядок величины значения. Не изобретай свою шкалу.
3. Не выводи характеристику, о которой в запросе ничего не сказано.
4. required ставь true, только если без этого условия вариант пользователю не подходит вовсе:
   явные маркеры «обязательно», «только», «нужен», «без этого никак», либо условие о том,
   кого заселяют (питомец, ребёнок, доступность). По умолчанию false.
   Пожелания комфорта («тихий», «с видом», «недалеко») — это false.
5. weight: 1.0 для главного условия запроса, 0.5-0.8 для второстепенных уточнений.
6. source_text — дословный фрагмент запроса, из которого взят интент.
7. Слова запроса, не покрытые ни одним интентом, перечисли в unmatched_terms.

Доступные характеристики:
{catalog}"""

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


def parse_query_schema(registry: Sequence[Characteristic]) -> dict[str, Any]:
    return _schema(
        "parsed_query",
        {
            "intents": {
                "type": "array",
                "items": _object(
                    {
                        "characteristic_key": {
                            "type": "string",
                            "enum": [item.key for item in registry],
                        },
                        "op": {"type": "string", "enum": [member.value for member in Op]},
                        "value": SCALAR,
                        "weight": {"type": "number", "minimum": 0, "maximum": 1},
                        "required": {"type": "boolean"},
                        "source_text": {"type": "string"},
                    }
                ),
            },
            "unmatched_terms": {"type": "array", "items": {"type": "string"}},
            "location_hint": {"type": ["string", "null"]},
        },
    )


def plan_tools_schema(registry: Sequence[Characteristic]) -> dict[str, Any]:
    keys = [item.key for item in registry if item.tool is not None]
    return _schema(
        "tool_plan",
        {
            "calls": {
                "type": "array",
                "items": _object(
                    {
                        "characteristic_key": {"type": "string", "enum": keys or ["none"]},
                        "subject": {"type": "string"},
                    }
                ),
            }
        },
    )


def extract_fields_schema(characteristic: Characteristic) -> dict[str, Any]:
    names = [rule.name for rule in characteristic.fields]
    return _schema(
        "extracted_fields",
        {
            "fields": {
                "type": "array",
                "items": _object(
                    {
                        "name": {"type": "string", "enum": names or ["none"]},
                        "value": SCALAR,
                        "quote": {"type": "string"},
                    }
                ),
            }
        },
    )


def field_list(characteristic: Characteristic) -> str:
    return json.dumps(
        [{"name": rule.name, "kind": rule.kind.value} for rule in characteristic.fields],
        ensure_ascii=False,
    )


def _schema(name: str, properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {"name": name, "strict": True, "schema": _object(properties)},
    }


def _object(properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": sorted(properties),
        "properties": properties,
    }
