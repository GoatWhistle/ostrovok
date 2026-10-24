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
| Фронтенд | verified | Поиск, MapLibre, факты, сравнение и кабинет по контракту; реальные health/catalog, остальные методы пока недоступны на сервере. 309 unit + 10 e2e на production-сборке | [Проверка](../work/frontend/validation.md), [аудит](../work/audits/frontend-1.md), 2026-10-25 |
| Контракт API | approved | 13 путей, 26 схем, валиден по OpenAPI 3.0.3; отдан фронту в ветке `feat/hotel-agent-mvp` | `uvx openapi-spec-validator docs/api/openapi.yaml` → OK, 2026-10-24 |
| Размещение кода | approved | Пакет `backend/src/hotel_agent`, слои `domain/application/adapters/interfaces` | [ADR 0002](../docs/adr/0002-layers-inside-backend.md), 2026-10-24 |
| Хранилище | approved | PostgreSQL 16 + PostGIS 3.4, сырой SQL через psycopg 3, миграции dbmate (вместо SQLAlchemy+Alembic из промпта) | [ADR 0001](../docs/adr/0001-postgis-raw-sql.md), 2026-10-24 |
| Стенд | verified | `make up` поднимает PostGIS 16.4 / PostGIS 3.4.3 (arm64) за ~100 с; `/api/v1/health` и `/api/v1/characteristics` отвечают из контейнера | `make up`, `curl localhost:8000/api/v1/health`, 2026-10-24 |
| Правило зависимостей | verified | `domain → adapters` ловится и import-linter, и тестом архитектуры | временный импорт в `domain/query.py`: обе проверки упали, 2026-10-24 |
| Домен фактов | verified | `Fact` с провенансом, TTL и статусами; затухание уверенности до 0,5 базовой на границе TTL; конфликты по правилу `hotelier > fresh_computed > osm_tag > stale_computed`; скоринг с `partial` для квалифицированных фактов | `tests/unit/domain/`, 73 теста, 2026-10-24 |
| Реестр характеристик | implemented | 7 YAML в `characteristics/`, новая характеристика добавляется файлом без правки кода | `tests/unit/adapters/registry/test_yaml_loader.py`, 2026-10-24 |
| LLM | verified | `fake` по умолчанию; `openai_compat` работает вживую: Yandex Cloud AI Studio, `yandexgpt-5.1`, structured output по JSON Schema. Ответ модели проверяется против реестра и против текста ответа отельера | `make llm-check`, 2026-10-25; [ADR 0003](../docs/adr/0003-yandex-openai-compatible-endpoint.md) |
| Исходные данные | verified | `make fetch-seed` скачал в `data/raw/`: Geofabrik «Южный ФО» 302 МБ (от 2026-10-24) и два тайла Copernicus GLO-30 (11 и 35 МБ). `data/raw/` в `.gitignore`, коммитится только срез в `data/seed/` | `make fetch-seed`, 2026-10-25 |
| Демо-данные | verified | `data/seed/sochi/`: 854 отеля, 105 981 здание, 147 баров, 78 линий берега, 115 пляжей, 2 015 источников шума, 34 028 пешеходных рёбер, DEM 1620x1440 float32 (−3,59..1787,91 м). 46,6 МБ, бюджет 50 МБ | `make build-seed`, 7 мин, 2026-10-25 |
| Высоты зданий | verified | В срезе Сочи `height` есть у 113 зданий, `building:levels` — у 37 378, ни того ни другого — у 68 490. Это и обосновывает три яруса уверенности 0,9 / 0,7 / 0,3 | `make build-seed`, 2026-10-25 |

## Pointers

- [Session](SESSION.md)
- [Open questions](open-questions.md)
- [Organizer materials](../brief/README.md)
- [Working artifacts](../work/README.md)
- [Product documentation](../docs/README.md)
