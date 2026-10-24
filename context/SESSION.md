# Session state

Updated: 2026-10-25, Europe/Moscow

## Explicit user instructions

- 2026-10-24: «Возьми задачу отсюда» + вставленный промпт «MVP "О!дин шаг до идеального отеля"»
  и файл контракта. Промпт — источник истины по задаче, `docs/api/openapi.yaml` — по форме ответов.
- 2026-10-24: «запушь сразу openAPI доку, чтобы параллельно фронт делать». Сделано: коммит
  `0e333c9` в ветке `feat/hotel-agent-mvp`.
- 2026-10-24, решения по развилкам: код в `backend/` с пакетом `hotel_agent` (не новый корень
  `hotel-agent/`); хранилище как в шаблоне — psycopg 3 + dbmate (не SQLAlchemy + Alembic);
  демо-данные Сочи тянуть отдельной командой `make fetch-seed`, не в `make seed` и не в тестах.
- 2026-10-24: «думаю точность делать как можно лучше» — реальный Copernicus GLO-30 и реальный
  OSM-экстракт, без грубых сеток высот и упрощённых графов.
- 2026-10-25: выдан API-ключ Yandex Cloud, использовать его для LLM, и качать данные. Ключ лежит
  только в `.env` (в `.gitignore`); folder ID `b1g8s6hsnfapn48225d1` получен из ответа API.
  Ключ засвечен в переписке — после хакатона отозвать.
- Из промпта, действует постоянно: LLM не угадывает значения фактов; значение даёт тулз или
  отельер. Без сети в `make seed` и в тестах. Ключи только в `.env`.

- 2026-10-25: «давай делай план как ты будешь добавлять фронт к беку и сделав ревью начинай писать фронт как закончишь сделай пуш ветки»
- 2026-10-25: «посмотри в ветке mvp уже бек есть проверь и сделай чтобы наша ветка от нее шла»
- User supplied Mapbox reference and CSS/JSON tokens; copied unchanged to work/design/source/. Frontend branch publication is now explicitly authorized.

## Current state

- Task: бэкенд — этапы 1 и 2 закрыты, живой LLM-провайдер сделан вне очереди, этап 3 наполовину:
  срез Сочи построен и лежит в `data/seed/sochi/`; базы, миграций и `ingest` ещё нет.
  Фронтенд влит из `feat/hotel-frontend` (коммиты 52c34d3, bcf0e31, 7d562e5).
- Branch and revision: `feat/hotel-agent-mvp`, см. `git log -1`.
- Stand: Compose поднимает `db` (imresamu/postgis:16-3.4) и `backend`; отвечают
  `GET /api/v1/health` и `GET /api/v1/characteristics`. Таблиц и миграций ещё нет.
- Фронтенд: поиск, результаты, геометрия MapLibre, подсветка, провенанс фактов, мутации отельера
  и сравнение. Типы генерятся из локального `docs/api/openapi.yaml`, рантайм-фикстур нет.
  Проверки фронта: typecheck, lint, 309 тестов, сборка, 10 e2e на продакшен-сборке включая axe.
  Отчёты — `work/frontend/`, `work/audits/frontend-1.md`. Эталон стиля — Mapbox dark,
  исходники пользователя в `work/design/source/`, описание — `frontend/DESIGN.md`.
- Экраны фронта ходят в реальное API: пока бэкенд отдаёт только `/health` и `/characteristics`,
  остальные экраны показывают честное состояние ошибки.

## How to continue

Этап 3 «Данные Сочи», остаток. Срез готов (`make build-seed`). Дальше: миграции dbmate
(первая включает PostGIS и создаёт GiST-индексы),
репозитории в `adapters/db/`, CLI `ingest --region sochi --from data/seed/sochi` в
`interfaces/cli/main.py`. Критерий: `make seed` укладывается в 60 с, в БД 100+ отелей с footprint — в срезе их 854.

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
- `make fmt` переписывает файл, и подготовленная текстовая замена перестаёт совпадать: правь файл
  после форматирования, а не до.
- Промпт без эталонов из реестра даёт плохой разбор: `yandexgpt-5.1` выдавал «тихий» как `eq 1` и
  ставил `required=true` всему подряд. Лечится примерами из `matchers` прямо в системном промпте.
- Импорт хелпера из `conftest.py` требует, чтобы `tests/` был пакетом: во всех каталогах под
  `tests/` лежит `__init__.py`, импорт пишется полным путём `tests.unit.domain.conftest`.

## Left, in order

1. Этап 3, остаток: миграции dbmate, репозитории, `ingest --region sochi`.
2. Этап 4: предрасчёт `building_height`, `distance_to_sea`, `bars_nearby`, `noise_level`.
3. Этап 5: `/search`, `/hotels/{id}`, `/hotels/{id}/scene`, `/geo-features:batch`, `/regions`.
4. Этап 6: `sunset_view` как тулз через `ToolRegistry`, кэш факта.
5. Этап 7: вопросы отельеру, извлечение полей, разрешение конфликта с тегом OSM.
6. Этап 8 (опционально): `eval` на разметке 30 отелей.
7. Подключить экраны фронта к готовым методам по мере их появления.

Полный план с задачами и критериями готовности — [work/plan.md](../work/plan.md).

## Red checks

Нет. `make lint` и `make test` зелёные: 212 unit + 5 contract, ruff, ruff format, mypy strict,
3 контракта import-linter. `make test-integration` пуст (exit 5) — интеграционных тестов ещё нет.
