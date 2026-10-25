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
   Один конкретный город сам по себе не противоречие: needs_clarification=false.
   Очевидная опечатка не требует уточнения. Не выдумывай город и данные об отелях.
   Язык причины и исправленного текста — язык запроса.
   location_hint — нормализованный город в именительном падеже. Если города нет в
   запросе, верни null. Не выводи город из желания быть рядом с морем или из истории
   ассистента. Очевидные сокращения вроде «СПб» нормализуй до Санкт-Петербурга.
   Адлер относите к Сочи; Красная Поляна — отдельное место.
   Даже если город неизвестен или запрос противоречив, извлекай все
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
   или facility_requests, или spatial_requests,
   перечисли в unmatched_terms. Не добавляй служебные слова вроде «хочу», «отель», «в», «с».
   Проверь каждую часть перечисления по отдельности: в фразе «с бассейном, баней и
   активностями поблизости» бассейн, баня и активности — три разных пожелания.
   Не пропускай условие, даже если рядом уже извлечено похожее.
   «Балкон на запад и закат» содержит ДВА условия: балкон как услуга отеля и
   западная сторона/вид на закат как отдельная характеристика.
   Если в запросе указано число гостей, извлеки room_capacity с gte и этим числом.
   Не превращай число гостей в требование двухместного номера.
8. Любые пожелания об объектах рядом запиши в nearby_objects, а не в intents.
   Исключение: именованные достопримечательности и центр города записывай в
   spatial_requests. Не заменяй конкретный памятник любым памятником того же типа.
   kind=city_center для желания жить в центре города; target=null.
   kind=landmark_view для вида на названный ориентир; target — его имя без слов
   «видно», «видом» и предлогов. kind=landmark_nearby для близости к названному
   ориентиру. kind=landmark_distance_min для «не ближе N км» от названного ориентира:
   radius_m — минимальное расстояние, а не максимальное. Если пользователь хочет вид
   на ориентир и одновременно «не ближе N км», запиши ДВА spatial_requests с разными
   source_text. Для вида в таком случае используй радиус не меньше N + 3000 м.
   Для «не ближе N км» ставь required=true: отель ближе этого расстояния не подходит.
   kind=sea_view для вида на море без названного ориентира, target=null.
   «Утром видеть море» и «номер с видом на море» — sea_view, НЕ sunset_view.
   sunset_view извлекай только при явном желании заката или западной стороны.
   Для вида по умолчанию radius_m=2000, для центра=1500, для близости=500;
   явное расстояние пользователя важнее. source_text — дословный фрагмент запроса.
   Не дублируй эти условия в nearby_objects или unmatched_terms.
   Для OSM используй osm_key из amenity, shop, leisure, tourism, historic, natural,
   healthcare, office, craft, man_made, emergency, public_transport, railway,
   aeroway, sport и osm_value по тегам OSM. Например, зоопарк: tourism=zoo.
   Для любых магазинов: osm_key=shop, osm_value=*. Для круглосуточных — open_24h=true.
   Для аптек: amenity=pharmacy. Не подменяй магазины барами.
   Для баров: amenity=bar. Радиус по умолчанию 500 м, если пользователь не назвал другой.
   10 км = 10000 м. source_text — дословный фрагмент.
   avoid=true, если пользователь требует отсутствие объекта в радиусе или минимальное
   расстояние до него: «без баров под окнами», «аэропорт минимум в 10 км».
   Это означает НОЛЬ таких объектов внутри radius_m. Не выдавай их наличие за совпадение.
   «Под окнами» считай радиусом 100 м, если расстояние не названо.
   required=true для явно обязательных геоусловий: «должен быть минимум», «ни одного»,
   «не ближе», «обязательно». Тогда найденный объект внутри запретного радиуса исключит отель.
   Такие слова не дублируй в unmatched_terms.
   Пожелания об услугах и оснащении самого отеля записывай в facility_requests:
   бассейн, шведский стол, парковка, сауна и любые другие услуги. Не ограничивайся
   перечисленными примерами. term — короткое название услуги для поиска среди названий
   услуг поставщика; для русскоязычного запроса пиши его по-русски в именительном падеже.
   Сохраняй точность пожелания: для «всё включено» term должен быть «всё включено»,
   а не общее «питание»; для «бани» term — «баня», а не общее «услуги».
   Для «тёплого бассейна» или «бассейна с подогревом» term — «бассейн с подогревом»,
   а не просто «бассейн». Не теряй уточняющие признаки услуги.
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
                        "avoid": {"type": "boolean"},
                        "required": {"type": "boolean"},
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
            "spatial_requests": {
                "type": "array",
                "items": _object(
                    {
                        "kind": {
                            "type": "string",
                            "enum": [
                                "city_center",
                                "landmark_view",
                                "landmark_nearby",
                                "landmark_distance_min",
                                "sea_view",
                            ],
                        },
                        "target": {"type": ["string", "null"]},
                        "radius_m": {"type": "integer"},
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
