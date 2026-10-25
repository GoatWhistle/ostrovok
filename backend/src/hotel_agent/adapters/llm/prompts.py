import json
from collections.abc import Sequence
from typing import Any

from hotel_agent.domain.characteristics import Characteristic, Op
from hotel_agent.domain.query import OSM_OBJECT_KEYS

SCALAR = {"type": ["boolean", "number", "string", "null"]}

PARSE_QUERY_SYSTEM = """\
Ты разбираешь поисковый запрос по отелям на интенты.

Правила:
0. Проверь запрос: исправь очевидные опечатки и географические ошибки в normalized_query.
   В corrections укажи исходный дословный фрагмент, исправленный вариант и короткую причину.
   Сохраняй смысл пожеланий. При противоречии не выбирай условие за пользователя:
   сохрани оба условия, объясни противоречие в corrections и поставь needs_clarification=true.
   При несовместимых городах/странах тоже поставь needs_clarification=true.
   Один конкретный город вне Сочи сам по себе не противоречие: needs_clarification=false.
   Очевидная опечатка не требует уточнения. Не выдумывай город и данные об отелях.
   Язык причины и исправленного текста — язык запроса.
   location_hint — нормализованный город. Доступный регион данных — Сочи;
   Адлер и Красную Поляну относите к Сочи. Другой город не подменяй Сочи.
   Даже если город вне доступного региона или запрос противоречив, извлекай все
   остальные пожелания в intents и nearby_objects. Не обнуляй их из-за ошибки места.
1. Бери характеристики только из списка ниже, операторы — только из перечня эталонов.
2. Для каждой характеристики ориентируйся на её эталоны: подбирай ближайший по смыслу
   и повторяй его оператор и порядок величины значения. Не изобретай свою шкалу.
3. Не выводи характеристику, о которой в запросе ничего не сказано.
   «Двухместный номер» не означает размещение с животными: pets_policy допустим только
   при явном упоминании питомца, собаки, кошки или другого животного.
4. required ставь true, только если без этого условия вариант пользователю не подходит вовсе:
   явные маркеры «обязательно», «только», «нужен», «без этого никак», либо условие о том,
   кого заселяют (питомец, ребёнок, доступность). По умолчанию false.
   Пожелания комфорта («тихий», «с видом», «недалеко») — это false.
5. weight: 1.0 для главного условия запроса, 0.5-0.8 для второстепенных уточнений.
6. source_text — дословный фрагмент запроса, из которого взят интент.
7. Содержательные условия запроса, не покрытые ни одним интентом, nearby_objects
   или facility_requests,
   перечисли в unmatched_terms. Не добавляй служебные слова вроде «хочу», «отель», «в», «с».
   Если в запросе указано число гостей, извлеки room_capacity с gte и этим числом.
   Не превращай число гостей в требование двухместного номера.
8. Любые пожелания об объектах рядом запиши в nearby_objects, а не в intents.
   Для OSM используй osm_key из amenity, shop, leisure, tourism, historic, natural,
   healthcare, office, craft, man_made, emergency, public_transport, railway,
   aeroway, sport и osm_value по тегам OSM. Например, зоопарк: tourism=zoo.
   Для любых магазинов: osm_key=shop, osm_value=*. Для круглосуточных — open_24h=true.
   Для аптек: amenity=pharmacy. Не подменяй магазины барами.
   Для баров: amenity=bar. Радиус по умолчанию 500 м, если пользователь не назвал другой.
   10 км = 10000 м. source_text — дословный фрагмент.
   Такие слова не дублируй в unmatched_terms.
   Пожелания об услугах и оснащении самого отеля записывай в facility_requests:
   бассейн, шведский стол, парковка, сауна и любые другие услуги. Не ограничивайся
   перечисленными примерами. term — короткое название услуги для поиска среди названий
   услуг поставщика; для русскоязычного запроса пиши его по-русски в именительном падеже.
   source_text — дословный фрагмент запроса. Не дублируй такие условия в unmatched_terms.
   required=true только при явно обязательном условии.
9. wants_room=true, если пользователь подбирает номер или спрашивает его доступность.
   check_in и check_out — только явно указанные однозначные даты в формате YYYY-MM-DD.
   Если даты относительные или неоднозначные, верни null: агент уточнит их.
   adults — только явно названное число взрослых. Вместимость номера не означает
   число заселяющихся взрослых: «двухместный номер» и «номер на 4-х» без состава
   гостей дают null. Для группы без состава спроси число взрослых.
   Не придумывай даты и состав гостей.

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
            "normalized_query": {"type": "string"},
            "needs_clarification": {"type": "boolean"},
            "wants_room": {"type": "boolean"},
            "check_in": {"type": ["string", "null"]},
            "check_out": {"type": ["string", "null"]},
            "adults": {"type": ["integer", "null"]},
            "corrections": {
                "type": "array",
                "items": _object(
                    {
                        "original": {"type": "string"},
                        "corrected": {"type": "string"},
                        "reason": {"type": "string"},
                    }
                ),
            },
            "nearby_objects": {
                "type": "array",
                "items": _object(
                    {
                        "osm_key": {"type": "string", "enum": list(OSM_OBJECT_KEYS)},
                        "osm_value": {"type": "string"},
                        "open_24h": {"type": "boolean"},
                        "radius_m": {"type": "integer"},
                        "source_text": {"type": "string"},
                    }
                ),
            },
            "facility_requests": {
                "type": "array",
                "items": _object(
                    {
                        "term": {"type": "string"},
                        "source_text": {"type": "string"},
                        "required": {"type": "boolean"},
                    }
                ),
            },
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
