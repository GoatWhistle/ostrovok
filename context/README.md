# Project context

Project: О!дин шаг до идеального отеля — агент собирает уникальные характеристики отелей из
открытых данных и у отельера, хранит их фактами с провенансом и ищет отели запросом на
естественном языке.
Hackathon and track: {{HACKATHON}}, {{TRACK}} — организаторские материалы ещё не заведены в `brief/`.
Deadline: {{date, time, timezone}}
P0 scenario: пользователь вводит «тихий номер с видом на закат недалеко от моря» и получает список
отелей с объяснением каждого совпадения, геообъектами для подсветки и параметрами камеры.

Фронтенд влит из `feat/hotel-frontend` в `feat/hotel-agent-mvp`; дальше обе части идут одной веткой.
Источник истины по API — [`docs/api/openapi.yaml`](../docs/api/openapi.yaml): форма ответов не
меняется без правки этого файла.

## Current facts

| Topic | Status | Current fact | Evidence |
|---|---|---|---|
| Фронтенд | verified | Слева рекомендации и карточка, в центре карта, справа раздельные чаты; 313 unit и браузерная проверка 1440/375 px. Карта принимает `footprint: null` для отелей без здания | [Доказательства](../docs/evidence.md), 2026-10-25 |
| Контракт API | implemented | HTTP-контракт диалога и карточки в OpenAPI, типы фронтенда сгенерированы из него | [`docs/api/openapi.yaml`](../docs/api/openapi.yaml), 2026-10-25 |
| Размещение кода | approved | Пакет `backend/src/hotel_agent`, слои `domain/application/adapters/interfaces` | [ADR 0002](../docs/adr/0002-layers-inside-backend.md), 2026-10-24 |
| Хранилище | approved | PostgreSQL 16 + PostGIS 3.4, сырой SQL через psycopg 3, миграции dbmate (вместо SQLAlchemy+Alembic из промпта) | [ADR 0001](../docs/adr/0001-postgis-raw-sql.md), 2026-10-24 |
| Стенд | verified | Compose поднимает PostGIS, backend и frontend; живой диалог, карточка и карта проверены на localhost:8080 | [Доказательства](../docs/evidence.md), 2026-10-25 |
| Правило зависимостей | verified | `domain → adapters` ловится и import-linter, и тестом архитектуры | временный импорт в `domain/query.py`: обе проверки упали, 2026-10-24 |
| Домен фактов | verified | `Fact` с провенансом, TTL и статусами; затухание уверенности до 0,5 базовой на границе TTL; конфликты по правилу `hotelier > fresh_computed > osm_tag > stale_computed`; скоринг с `partial` для квалифицированных фактов | `tests/unit/domain/`, 73 теста, 2026-10-24 |
| Реестр характеристик | implemented | 8 YAML в `characteristics/`, новая характеристика добавляется файлом без правки кода | `tests/unit/adapters/registry/test_yaml_loader.py`, 2026-10-24 |
| LLM | verified | `fake` по умолчанию; стенд использует DeepSeek V4.1 Flash через Yandex Cloud. Модель извлекает пожелания и контекст, факты приходят из БД и геотулзов | Живой диалог, 2026-10-25; [ADR 0003](../docs/adr/0003-yandex-openai-compatible-endpoint.md) |
| Исходные данные | verified | `make fetch-seed` скачал в `data/raw/`: Geofabrik «Южный ФО» 302 МБ (от 2026-10-24) и два тайла Copernicus GLO-30 (11 и 35 МБ). `data/raw/` в `.gitignore`, коммитится только срез в `data/seed/` | `make fetch-seed`, 2026-10-25 |
| OSM России | verified | PBF 4,19 ГБ прошёл MD5; в PostGIS 33 233 отеля, 9 758 566 POI, 8 951 260 пешеходных рёбер, 31 468 береговых, 568 173 шумовых линий и 1 595 433 здания рядом с отелями. Свой контур найден у 30 304 отелей | [Исследование](../work/research/russia-map-download.md), 2026-10-25 |
| Рельеф России | verified | Сочи использует локальный Copernicus GLO-30, остальные города — Mapterhorn через API; тайл Москвы вернул высоты 119,2–178,3 м. 3D здания проверены на карте Москвы на 1440 и 375 px | [Доказательства](../docs/evidence.md), 2026-10-25 |
| Поиск городов | verified | Модель извлекает город; без него чат спрашивает. Москва и Казань возвращают по 20 отелей; смена города в одном чате проверена. Сочи использует отдельный срез | [Доказательства](../docs/evidence.md), 2026-10-25 |
| Демо-данные | verified | `data/seed/sochi/`: 854 отеля, 105 981 здание, 147 баров, 78 линий берега, 115 пляжей, 2 015 источников шума, 34 028 пешеходных рёбер, DEM 1620x1440 float32 (−3,59..1787,91 м). 46,6 МБ, бюджет 50 МБ | `make build-seed`, 7 мин, 2026-10-25 |
| Высоты зданий | verified | В срезе Сочи `height` есть у 113 зданий, `building:levels` — у 37 378, ни того ни другого — у 68 490. Это и обосновывает три яруса уверенности 0,9 / 0,7 / 0,3 | `make build-seed`, 2026-10-25 |
| Номера | verified | Для 15 сопоставленных отелей загружены 89 категорий и услуги из каталога Nuitee; остальные 839 отелей без подтверждённых номеров | [Доказательства](../docs/evidence.md), 2026-10-25 |
| Предложения на даты | verified | Nuitee sandbox подключён; для проверенных дат Сочи вернул `no_offers`, что не означает заполненность. ETG доступен как альтернативный адаптер | [Доказательства](../docs/evidence.md), 2026-10-25 |

## Pointers

- [Session](SESSION.md)
- [Open questions](open-questions.md)
- [Organizer materials](../brief/README.md)
- [Working artifacts](../work/README.md)
- [Product documentation](../docs/README.md)
