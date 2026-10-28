# Задачи и подводные камни до 2026-10-29

Перенесено из `context/SESSION.md` при сжатии 2026-10-29: часть пунктов выполнена, часть
дублировалась, часть заменена более поздними замерами. Сохранено дословно.

## Next actions and pitfalls

- Кабинет отельера на бэкенде: ветка `feat/hotelier-cabinet`, всё в [work/hotelier-cabinet/README.md](../work/hotelier-cabinet/README.md). Оповещения, вопросы по спросу, сводка, ответ в один тап, ссылка на вопрос, объяснение отказа, датасет и ссылка OSM у каждого факта. Слито в `feat/hotel-agent-mvp`. Проверено на отдельном стенде (порты 5442/8010), общий не трогался. Ответ отельера пока не меняет ту же выдачу. На стенде кода нет: нужны `dbmate up` (миграция `20261028120000_hotelier_notifications`) и пересборка образа.
- После агентов ролика, теней/ночного города и боковой панели: архитектурная уборка frontend/src по просьбе пользователя 2026-10-28 (см. инструкции), затем пересборка стенда и финальная проверка.

- Когда агенты карты (a7ef96d7), чата (a6c7cf22) и мобильной версии (a09b4cfb) закончат и всё запушено: пересобрать стенд целиком (бэкенд и фронт вместе, `lod-v3`), затем полная проверка UI/UX по просьбе пользователя 2026-10-28, найденное исправить самому или отдать агенту.

- Покрытие ТЗ по [work/task-coverage/plan.md](../work/task-coverage/plan.md) пройдено целиком, кроме пункта 4 (ведётся в `o-hack-window-views`). Полностью: 1, 2, 3, 6, 7, 10. Частично с названной границей: 5 (нет разметки для точности), 8 (источник не отдаёт этажи номеров), 9 (OpenAQ, OpenCellID, Mapillary требуют ключей; подключён Commons). Вид на закат считается: 774 факта по Сочи, дуга 284–303°, этаж по профилю горизонта.

- Разбор и критика решения на живом стенде 2026-10-27: [work/task-coverage/review-2026-10-27.md](../work/task-coverage/review-2026-10-27.md) (+ PDF). Главное: выдача ранжируется вырожденно (все отели с одной оценкой, порядок алфавитный), на стенде 0 вопросов отельеру и 0 конфликтов, `source_url` пуст у всех 12 544 фактов, 1 453 факта просрочены, `took_ms` в чате всегда 0.

- ТЗ трека записано дословно в `brief/TASK.md`, требования R1–R9 и O1–O5 в `brief/requirements.md` (2026-10-27). Текущая очередь работ: [work/task-coverage/plan.md](../work/task-coverage/plan.md) — P0: прогон из чистого клона с замером (R7/R8), расчёт вида на закат, актуализация `docs/requirements-map.md`, закрытие цели по виду из окна.

- Evolution plan has no open items. Known follow-ups: 375 px chat tab after leaving the full map shows no composer (not investigated); panning cost in dense center. Untracked `work/hotelier-demo/`, `work/map-neon/night*` belong to other work, keep out of commits. Protected user instructions exceed the SESSION target and remain verbatim.

- Window-view goal remains active/incomplete;50-query post-update evaluation pending. [Prior view plan](../work/window-views/plan.md). Root concurrent chat/geo/provider work may postdate the snapshot; preserve it. Model429/latency observed in other runs; no uncontrolled concurrent paid batches.
- Build with explicit TAG before replacing pinned images. Root .env model credentials unchanged. Instructions remain verbatim despite SESSION target overflow.
- Сопоставление отелей и веб-фоллбэк (литера и строение в номере дома, 151 943 населённых пункта из PBF командой `ingest-settlements`, рабочий веб-поиск, карточка из публичной страницы с microdata в `/hotels/{id}/offers`): 27%→42% на 40 отелях, замеры, причины отказов и ограничения в [coverage-probe](../work/hotel-data/coverage-probe/README.md); источники помимо Островка — [research](../work/research/hotel-sources-beyond-ostrovok-2026-10-27.md). Коммиты `74ee9de`…`6fd59b1`, не пушил.
- Стенд: `hotel-web-card-20261027` (бэкенд), фронт `faster-search-20261027h`. Запрос про Трампа нестабилен (отель находится примерно в трети прогонов) — ограничение выдачи поиска, не кода. Ускорение поиска доведено: Казань 94→31 с, Сочи 131→64 с, Кострома пусто за 185–203 с → 20 отелей за 39 с, Эрмитаж 36 с. Запрос про Трампа теперь пуст за 54 с: пожелание закрывается, но итоговая проверка справедливо отклоняет цитату «the Ritz» без привязки к объекту — это пункт об идентичности, не о скорости. Таблицы и разбор: [work/web-search-fix/remaining.md](../work/web-search-fix/remaining.md).

- Поставщик, карточка, интерфейс, карта и свет сцены: решения в [design-decisions](../docs/design-decisions.md), числа в [evidence](../docs/evidence.md) и [catalog-match](../work/hotel-data/catalog-match/README.md). Ветка не пушилась.
- Не закоммичены чужие незавершённые правки в docs/*.md, context/README.md и work/README.md. В переписанном другой сессией docs/design-decisions.md осталась строка про удалённый поиск по прямоугольнику (`test_truncated_search_is_an_error...`) — убрать после их коммита.

- Дождаться финального прогона 50 запросов на `final-20261028` и перезапустить 6 диалогов:
  проверить, что «город не важен» ищет по России и что третье условие сужает выдачу.
- Фронтовые находки не исправлены намеренно: пользователь просил вынести фронт в артефакт, а
  чинить бэкенд. Чинить отдельной задачей по артефакту.
- Цена правки: `edge_impossible_floor` потерял содержательный ответ про 37 этажей в Сочи
  (при непустой выдаче ответ сочиняется заново и не проходит ревью, срабатывает `safe_answer`).
  Из 8 оживших запросов 6 дают содержательный ответ, 2 — шаблонный.
- Пересмотр пайплайна: [plan](../work/pipeline-revision/plan.md); P1 пункты 4 (именованные ключи
  вместо хеша) и 5 (класс волатильности) и P2 6–8 не сделаны.
- Покрытие ТЗ: [plan](../work/task-coverage/plan.md) пройдено, кроме пункта 4 (высоты зданий вдоль
  лучей вне Сочи). Разбор: [review](../work/task-coverage/review-2026-10-27.md).
- Собирать образ с явным TAG перед заменой закреплённых. Ключи моделей только в корневом `.env`.
  Инструкции пользователя хранятся дословно и превышают целевой размер SESSION.
- Номера и слои карты 2026-10-28, слито в `feat/hotel-agent-mvp`: вид и этаж категории из карточки Alean, спальные места из тарифов Островка, аллеи и предметы на карте, тайлы `lod-v4`. Проверки и ограничения: [work/room-map-data/README.md](../work/room-map-data/README.md). Стенд не миграцировался: нужны `dbmate up` и `import_map_layers`.
