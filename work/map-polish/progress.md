# Выполнение спеки

26.10.2026. Пользователь: «начинай выполнение спеки».
Рабочая копия `/tmp/o-hack-sochi`, ветка `feat/hotel-agent-mvp`, исходный HEAD `8e229bc`.

Завершённые локальные коммиты (пуш ещё не выполнялся):
- `1972c33`: компактная погода, общий Popover, слот сравнения в карте. Verify 335 tests, браузер 375/1440 RU/EN light/dark: 8/8.
- `fc30d1e`: сворачиваемые чипы маршрута/свойства. Verify и браузер 8/8.
- `f40cd7d`: cluster radius40/maxZoom15, cobalt pins, spiderfy совпадающих отелей на z18. Verify 343 tests, браузер 8/8.
- `66813b4`: чистая раскладка подписей, ResizeObserver/rAF, препятствия, короткая подпись маршрута. Verify 343 tests; Abris 8 вариантов × камеры без пересечений. Cosmos: все 8 вариантов × z15–18/bearing0,90,180/pitch0,60 прошли без пересечений подписей.

- `d807daa`: восстановлен compare endpoint.
- `63c1c9f`: PlaceCard contract и comparison metadata.

- `daab0fa`: карточки сравнения; 16 браузерных сочетаний + partial error/long-name checks.
- `dad3825`: маршруты до POI, общий граф/80 м/мин, LRU/TTL, virtual refs. Два реальных отеля, 20 empty-cache runs: median59.50/65.55ms, max103.80/107.26ms. 35ms ориентир не подтверждён; ≤1s выполнен на выборке.
- `9d4b9ac`: PlaceCard API, белый список тегов, Subject.place, источник/дата/уверенность/status.
- `c3b6abe`: несколько путей и dashed fallback, кликабельные места, PlaceDetails, собственный hours parser, время из погоды, старые сохранённые диалоги получают virtual refs.

Текущее состояние:
- Часть1 code complete. Frontend verify352, backend419 unit/contract/integration +ruff/mypy/import contracts. Eight place matrix +4 edges/AIDA5routes +weatherhourbinding passed. Cosmos8×24 cameras completed; checks labels-vs-labels/pins, not all pin-pairs.
- Основной стенд пересобран: UI18082/API18083/DB15432 healthy. Smoke 1440/375 RU dark passed; health/place/compare HTTP200 through UI proxy. Первый push после документации.
- Part2 not started. Spec prohibits final-style integration before userchoice. No new runtime dependencies.
- Browser scripts use saved conversations, no paid calls. Screenshots: evidence/; product evidence subset docs/evidence/map-polish.
- Main Sochi production runs private env unchanged. Preview18085 → isolated fake API18086, sharedrealDB.
- Host Node20 unsupported; verify via Docker node24 mountedwholeworktree. UV_CACHE_DIR=/tmp/o-hack-uv-cache; TestClient tests need escalated execution (sandbox hangs).
- Git fetch: origin/feat/hotel-agent-mvp remains original8e229bc; 9 then10localcommits. Do not stage/overwrite teammate context/SESSION.md or unrelated untracked workdirs.
- Root context (/home/ikhail_horokhorin/projects/o-hack/context/SESSION.md) holds currentprogress and protectedauth. Keepdetails here tolimitcontext.
