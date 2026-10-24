# Session state

Updated: 2026-10-24, MSK

## Explicit user instructions

- 2026-10-24: «Возьми задачу отсюда» + вставленный промпт «MVP "О!дин шаг до идеального отеля"»
  и файл контракта. Промпт — источник истины по задаче, `docs/api/openapi.yaml` — по форме ответов.
- 2026-10-24: «запушь сразу openAPI доку, чтобы параллельно фронт делать». Сделано: коммит
  `0e333c9` в ветке `feat/hotel-agent-mvp`.
- 2026-10-24, решения по развилкам: код в `backend/` с пакетом `hotel_agent` (не новый корень
  `hotel-agent/`); хранилище как в шаблоне — psycopg 3 + dbmate (не SQLAlchemy + Alembic);
  демо-данные Сочи тянуть отдельной командой `make fetch-seed`, не в `make seed` и не в тестах.
- Из промпта, действует постоянно: LLM не угадывает значения фактов; значение даёт тулз или
  отельер. Без сети в `make seed` и в тестах. Ключи только в `.env`.

## Current state

- Task: этап 1 «Скелет» закрыт. Следующий — этап 2 «Домен и реестр».
- Branch and revision: `feat/hotel-agent-mvp`, см. `git log -1`.
- Stand: Compose поднимает `db` (imresamu/postgis:16-3.4) и `backend`; отвечают
  `GET /api/v1/health` и `GET /api/v1/characteristics`. Таблиц и миграций ещё нет.

## How to continue

Этап 2 «Домен и реестр»: сущности `Fact`, `Provenance`, `GeoFeature`, `Conflict`,
`HotelierQuestion` в `backend/src/hotel_agent/domain/`; доменные сервисы
`conflict_resolver.py`, `confidence.py`, `scoring.py`. Реестр и его загрузчик уже готовы
(`adapters/registry/yaml_loader.py`), из критериев этапа 2 остаются конфликты, затухание
уверенности и TTL.

## Pitfalls already hit

- YAML: `?` и `: ` внутри flow-мэппинга и внутри plain-скаляра ломают парсер. В контракте
  закавычен пример `HotelierQuestion.text`, в `characteristics/*.yaml` — `description` и
  `question_template`.
- `uv sync` без `.python-version` выбрал Python 3.14t, а образ собирается на 3.12. Добавлен
  `backend/.python-version` = `3.12`.
- `postgis/postgis:16-3.4` публикуется только под amd64 — на arm64 шёл бы через эмуляцию.
  Заменён на `imresamu/postgis:16-3.4`.
- Два `conftest.py` ломали mypy («Duplicate module named conftest»). Лечится
  `explicit_package_bases` и `mypy_path = "src:."`.

## Left, in order

1. Этап 2: домен фактов, провенанс, конфликты, затухание уверенности, TTL.
2. Этап 3: `make fetch-seed` (разово, с сетью) и `ingest --region sochi`, миграции dbmate.
3. Этап 4: предрасчёт `building_height`, `distance_to_sea`, `bars_nearby`, `noise_level`.
4. Этап 5: `/search`, `/hotels/{id}`, `/hotels/{id}/scene`, `/geo-features:batch`, `/regions`.
5. Этап 6: `sunset_view` как тулз через `ToolRegistry`, кэш факта.
6. Этап 7: вопросы отельеру, извлечение полей, разрешение конфликта с тегом OSM.
7. Этап 8 (опционально): `eval` на разметке 30 отелей.

## Red checks

Нет. `make lint` и `make test` зелёные: 67 unit + 5 contract, ruff, ruff format, mypy strict,
3 контракта import-linter. `make test-integration` пуст (exit 5) — интеграционных тестов ещё нет.
