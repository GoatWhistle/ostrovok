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
- Из промпта, действует постоянно: LLM не угадывает значения фактов; значение даёт тулз или
  отельер. Без сети в `make seed` и в тестах. Ключи только в `.env`.

- 2026-10-25: «давай делай план как ты будешь добавлять фронт к беку и сделав ревью начинай писать фронт как закончишь сделай пуш ветки»
- 2026-10-25: «посмотри в ветке mvp уже бек есть проверь и сделай чтобы наша ветка от нее шла»
- User supplied Mapbox reference and CSS/JSON tokens; copied unchanged to work/design/source/. Frontend branch publication is now explicitly authorized.

## Current state

- Frontend implementation and review complete on feat/hotel-frontend. Code commit 52c34d3, based on origin/feat/hotel-agent-mvp at adb6014d1c0e19d7e5d69d072a0dcc21e894377d. Branch published to origin/feat/hotel-frontend; final archive-byte correction follows in the same branch.
- Plan and pre-code review: work/frontend/plan.md. User-picked Mapbox dark reference, React/CSS Modules, RU/EN, both themes, real API only.
- Backend verification: 147 unit/contract tests passed. Only /health and /characteristics served; search/scene/hotelier routes remain pending. Backend code is not owned by this frontend task.
- Implemented search/results, MapLibre geometry/highlights, fact evidence, hotelier mutations and comparison. Types generated from local OpenAPI. No runtime fixtures.
- Verify passed: 36 rules, typecheck/lint, 309 tests/build; 10 e2e on the production build incl axe and long-text mobile case. Independent finish verdict: ship. See work/frontend/validation.md and work/audits/frontend-1.md.
- DESIGN.md and .impeccable/design.json document the actual supplied world. No terrain/basemap/Cera Pro assets.
- Node 22 shim /tmp/o-hack-node22/bin. Backend env /tmp/o-hack-frontend-backend-env. Preview http://127.0.0.1:15173, backend :18000; task-owned servers may be stopped after checks.
- Publish only feat/hotel-frontend; do not push MVP/main. Implementation commit: 52c34d3. Git HEAD at final session update: bcf0e31; the final correction preserves source attachment bytes.
- Impeccable context failed (cache permission/engine unavailable); permitted fallback reads PRODUCT/DESIGN. UI UX generator consulted for UX only; source reference owns palette/type.

## How to continue

Frontend implementation is complete; review/validation are in work/frontend/. Implementation and documentation are published. Backend integration can proceed when pending methods exist. Do not resume backend stages below in this branch.

Этап 3 «Данные Сочи». Сначала `make fetch-seed` (разово, с сетью, вне `make seed` и тестов):
Geofabrik «Южный ФО» → обрезка по bbox Сочи, Copernicus GLO-30 → crop по тому же bbox, результат
в `data/seed/sochi/`. Затем миграции dbmate (первая включает PostGIS и создаёт GiST-индексы),
репозитории в `adapters/db/`, CLI `ingest --region sochi --from data/seed/sochi` в
`interfaces/cli/main.py`. Критерий: `make seed` укладывается в 60 с, в БД 100+ отелей с footprint.

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
- Импорт хелпера из `conftest.py` требует, чтобы `tests/` был пакетом: во всех каталогах под
  `tests/` лежит `__init__.py`, импорт пишется полным путём `tests.unit.domain.conftest`.

## Left, in order

1. Этап 3: `make fetch-seed` (разово, с сетью) и `ingest --region sochi`, миграции dbmate.
2. Этап 4: предрасчёт `building_height`, `distance_to_sea`, `bars_nearby`, `noise_level`.
3. Этап 5: `/search`, `/hotels/{id}`, `/hotels/{id}/scene`, `/geo-features:batch`, `/regions`.
4. Этап 6: `sunset_view` как тулз через `ToolRegistry`, кэш факта.
5. Этап 7: вопросы отельеру, извлечение полей, разрешение конфликта с тегом OSM.
6. Этап 8 (опционально): `eval` на разметке 30 отелей.

## Red checks

Нет. `make lint` и `make test` зелёные: 142 unit + 5 contract, ruff, ruff format, mypy strict,
3 контракта import-linter. `make test-integration` пуст (exit 5) — интеграционных тестов ещё нет.
