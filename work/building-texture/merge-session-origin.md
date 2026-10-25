# Session state before merging the texture branch

## Target branch

## Current state

- Ветка `feat/hotel-agent-mvp`, код `95c5693` (агент `9a341c0`, объединены 4 входящих frontend-коммита до `afa5953`). Основной стенд localhost:8080, backend :8000, PostGIS healthy. План и результаты 50 сообщений: `b957c55`, [отчёт](../work/evals/diverse-50-review.md).
- Агент исследует непроверенные пожелания через inspect_data/find_hotels/read_records/measure_terrain. Владикавказ: горные кандидаты с DEM; >1500 м — два объекта, страна проверена; горы и ≤900 м — уточнение; 17-й этаж неизвестен. [Результаты](../work/evals/mountain-agent-review.md). Финальный backend развёрнут, 281 тест/Ruff/mypy/import-linter прошли. Входящий frontend пересобран; npm verify: 313 тестов, 36 правил, typecheck/lint/build прошли.

## Next actions and pitfalls

- Ошибки семантики из 50 сообщений не все закрыты: одноимённые POI, неверные теги и потеря пожеланий. Выбор оценочного критерия моделью вариативен; каталог номеров/услуг неполон. Сбои LLM и приближения DEM остаются. [Доказательства](../docs/evidence.md), [архив](../work/session-state-2026-10-25-evening.md).

## Texture branch

## Current state

- Ветка `feat/satellite-building-texture`, отдельный worktree `/Users/savelij/.codex/worktrees/1e4a/o-hack`, код карты `01a033f`, исходный GLB `49af5b3`; свидетельства MVP синхронизированы с `b957c55` без изменений исходного checkout.
- В карте приложения текстура натягивается только на выбранный отель по его контуру и высоте API. Смена/снятие выбора освобождает старый GPU-слой. Соседние здания обычные. [Решение](../docs/design-decisions.md), [проверки](../work/building-texture/README.md).
- Приложение dev :5181, production `http://127.0.0.1:5182/`, оба используют живой backend :8000. GLB-превью :8766 отдельно. Ревью: `ship`; [отчёт](../work/building-texture/finish-review.md).

## Next actions and pitfalls

- 36 правил, TypeScript, Biome, 320 тестов и build прошли; 12 браузерных сценариев на реальном API, включая сбои изображения/шейдера и восстановление WebGL. Новых платных вызовов модели нет.
- Материал условный, крыша плоская; размеры и высоты только из API. Отель без пригодного контура/высоты не получает выдуманное здание. Исходный GLB на 51 м не используется вместо текущей API-геометрии.
- Корневой checkout содержит чужие незакоммиченные backend-изменения: не трогать. SESSION превышает целевой размер из-за защищённых пользовательских инструкций, сохранённых дословно.
