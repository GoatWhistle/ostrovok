# Project context

Project: О!дин шаг до идеального отеля — агент собирает уникальные характеристики отелей из
открытых данных и у отельера, хранит их фактами с провенансом и ищет отели запросом на
естественном языке.
Hackathon and track: {{HACKATHON}}, {{TRACK}} — организаторские материалы ещё не заведены в `brief/`.
Deadline: {{date, time, timezone}}
P0 scenario: пользователь вводит «тихий номер с видом на закат недалеко от моря» и получает список
отелей с объяснением каждого совпадения, геообъектами для подсветки и параметрами камеры.

Фронт (3D-карта) делает другая команда. Наша зона — бэкенд и данные.
Источник истины по API — [`docs/api/openapi.yaml`](../docs/api/openapi.yaml): форма ответов не
меняется без правки этого файла.

## Current facts

| Topic | Status | Current fact | Evidence |
|---|---|---|---|
| Контракт API | approved | 13 путей, 26 схем, валиден по OpenAPI 3.0.3; отдан фронту в ветке `feat/hotel-agent-mvp` | `uvx openapi-spec-validator docs/api/openapi.yaml` → OK, 2026-10-24 |
| Размещение кода | approved | Пакет `backend/src/hotel_agent`, слои `domain/application/adapters/interfaces` | [ADR 0002](../docs/adr/0002-layers-inside-backend.md), 2026-10-24 |
| Хранилище | approved | PostgreSQL 16 + PostGIS 3.4, сырой SQL через psycopg 3, миграции dbmate (вместо SQLAlchemy+Alembic из промпта) | [ADR 0001](../docs/adr/0001-postgis-raw-sql.md), 2026-10-24 |
| Стенд | verified | `make up` поднимает PostGIS 16.4 / PostGIS 3.4.3 (arm64) за ~100 с; `/api/v1/health` и `/api/v1/characteristics` отвечают из контейнера | `make up`, `curl localhost:8000/api/v1/health`, 2026-10-24 |
| Правило зависимостей | verified | `domain → adapters` ловится и import-linter, и тестом архитектуры | временный импорт в `domain/query.py`: обе проверки упали, 2026-10-24 |
| Реестр характеристик | implemented | 7 YAML в `characteristics/`, новая характеристика добавляется файлом без правки кода | `tests/unit/adapters/registry/test_yaml_loader.py`, 2026-10-24 |
| LLM | implemented | Порт `LLMPort`, детерминированный адаптер `fake` на синонимах реестра; `anthropic` и `openai_compat` падают с явной ошибкой | `tests/unit/adapters/llm/test_fake.py`, 2026-10-24 |
| Демо-данные | open | `data/seed/sochi/` пуст; решено тянуть разовой командой `make fetch-seed`, она ещё не написана | решение пользователя, 2026-10-24 |

## Pointers

- [Session](SESSION.md)
- [Open questions](open-questions.md)
- [Organizer materials](../brief/README.md)
- [Working artifacts](../work/README.md)
- [Product documentation](../docs/README.md)
