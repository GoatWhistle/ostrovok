# Состояние сессий до компактизации 2026-10-28

Перенесено из `context/SESSION.md` целиком и дословно, чтобы уложиться в бюджет.
Ссылка на этот файл стоит в `context/SESSION.md`.

## Current state

- 2026-10-28, ветка `feat/hotel-agent-mvp`, HEAD `5a86722`, образ бэкенда `final-20261028`.
  Прогон 50 разных запросов (номера, рядом, события, вид, условия, история, абсурд, край):
  до правок 27 пустых выдач, из них 11 правильных (абсурд, чужой город, противоречие).
  11 пустых были отказом ревью; контрольный прогон 20 запросов: 8 из них дали результаты,
  абсурд остался пустым (регрессии нет). Данные: `work/ui-review/`, прогоны в скретчпаде сессии.
- Исправлено в бэкенде: ближайшие совпадения вместо пустой выдачи, когда ревью не подтвердило
  ничего (короткий список, не целая страница); радиус для аэропортов и крупных объектов;
  поиск по названному объекту, когда город неизвестен («Шереметьево»); отказ от ответа с чужой
  письменностью (в ответ протекал китайский); «город не важен» теперь детерминированно включает
  поиск по всей России. Звёзды — последний разрыв ничьих в ранжировании.
- `make precompute` не запускался после загрузки номеров: `double_room` было 0 фактов при 89
  номерах в 15 отелях. Запущен, 15 фактов (14 true). Запросы про двухместные номера ожили.
- Диалоги из 6 сценариев: накопление и снятие условий, смена города и переход от совета к поиску
  работают. Не работает порядковая ссылка «покажи первый подробнее» — у чата нет режима выбора
  отеля из выдачи, только `selected_hotel_id` от фронта.
- Карта: подложка Сочи отдаётся и рисуется полностью; подложки России нет (13 ГБ,
  `make fetch-basemap-russia`), поэтому лендинг показывает пустой фон. Бэкенд отвечает честно
  (`available:false, reason:basemap_missing`), молчит фронт. Докачка запущена 2026-10-28.
- Находки по UI/UX вынесены в артефакт: https://claude.ai/artifact/VSkFGDkwJ64W39Vktbcvj8
  (P0 — пустая карта без объяснения; P1 — перенос названий, «0.1 мин», лента прижата к потолку,
  незавершающиеся анимации ломают `npm run shots`).

- Main/origin2d2fd12; backend view-corridor-20261026 image14de83d8 healthy200. Only3geometrymodules overlaid on independentfdcd62b4 runtime; TAGpersisted,frontendunchanged.817clean/833root unitcontract+12DBtests passed.
- NativeOstankino now2positive rays, independentaudit0errors; 40535terminal3/3pass;15672+22504stoppedSIGINTbyuser.18801terminal dueindependentdeploy;Onega/russianbridge/nevyan resumed. Goal incomplete:50processed acrossversions27auto18review5special. [Evidence](../../o-hack-stand/work/window-views/review-probe/README.md).
- Moscow-City complex absent locally; externalidentity+geometryneeded. Independent event/web workdirty,preserved. Priorstate:[archive](../work/window-views/session-before-round15.md). Protectedverbatimquotes exceedSESSIONtarget.
- Frontend evolution plan complete on `feat/hotel-agent-mvp`: E00–E18 and H01–H07 verified, [result](../work/frontend-evolution/result.md), [progress](../work/frontend-evolution/progress.md). Rebased onto teammate `1d48e8f` and pushed `1d48e8f..849cf10` at user request; final E17 document commit follows. Mobile layout skipped by user; panning p95 ≤33 ms missed in center/shore (E15).
- Isolated FakeLLM/PostGIS Compose `hotel-evolution`, API :18085, DB :15435, frontend :5179 (`API_URL=:18085 MAP_ASSET_URL=:18082 npx vite --host 127.0.0.1 --port 5179`; restarted 2026-10-27 after it stopped). Node24 `/tmp/hotel-node24/bin`. Russia basemap complete and verified: 13,315,380,122 bytes, basemap-e9827062f2ba; root work/russia-download. Synthetic hotelier region bbox corrected to fixture extent.

## Historical state

- Earlier stand, window-view, web-research and supplier-catalog notes: [archive](../work/session-before-e15-2026-10-27.md).

## Next actions and pitfalls

- Дождаться финального прогона 50 запросов на образе `final-20261028` и перезапустить 6 диалогов:
  проверить, что «город не важен» ищет по России, а третье условие сужает выдачу, а не расширяет.
- Фронтовые находки из артефакта не исправлены намеренно: пользователь просил вынести фронт в
  артефакт, а чинить бэкенд. Чинить их отдельной задачей.
- Известная цена правки: `edge_impossible_floor` потерял содержательный ответ про 37 этажей в Сочи
  (ответ сочиняется заново при непустой выдаче и не проходит ревью, срабатывает `safe_answer`).
  Из 8 оживших запросов 6 дают содержательный ответ, 2 — шаблонный.
- Инверсий качества совпадения в топ-3 на 50 запросах не найдено (0 из 50), поэтому порог
  «уверенность перебивает тир» трогать не стал: дефект теоретический, не наблюдаемый.

- Когда агенты карты (a7ef96d7), чата (a6c7cf22) и мобильной версии (a09b4cfb) закончат и всё запушено: пересобрать стенд целиком (бэкенд и фронт вместе, `lod-v3`), затем полная проверка UI/UX по просьбе пользователя 2026-10-28, найденное исправить самому или отдать агенту.

- Покрытие ТЗ по [work/task-coverage/plan.md](../work/task-coverage/plan.md) пройдено целиком, кроме пункта 4 (ведётся в `o-hack-window-views`). Полностью: 1, 2, 3, 6, 7, 10. Частично с названной границей: 5 (нет разметки для точности), 8 (источник не отдаёт этажи номеров), 9 (OpenAQ, OpenCellID, Mapillary требуют ключей; подключён Commons). Вид на закат считается: 774 факта по Сочи, дуга 284–303°, этаж по профилю горизонта.

- Разбор решения и архитектуры 2026-10-27: [review](../work/task-coverage/review-2026-10-27.md), [architecture](../work/task-coverage/architecture-2026-10-27.md) (+ PDF). Не закрыто планом пересмотра: `source_url` пуст у всех фактов, `took_ms` в чате всегда 0 (`main.py` передаёт 0 в `search_schema`).

- Пересмотр пайплайна: [work/pipeline-revision/plan.md](../work/pipeline-revision/plan.md) (2026-10-28). Замеры: 101 из 178 поисков дают всем отелям одну оценку (порядок алфавитный), 80 321 открытый вопрос отельеру при 1 отвеченном (CROSS JOIN в `CANDIDATES`), 636 просроченных фактов остались active, 494 факта «не смог проверить» лежат в `facts` и кешируются. P0: ранжирование по запасу измерения и уверенность отдельной осью; вопрос только отелю из выдачи; чистка `facts`.

- ТЗ трека записано дословно в `brief/TASK.md`, требования R1–R9 и O1–O5 в `brief/requirements.md` (2026-10-27).

- Evolution plan has no open items. Known follow-ups: 375 px chat tab after leaving the full map shows no composer (not investigated); panning cost in dense center. Untracked `work/hotelier-demo/`, `work/map-neon/night*` belong to other work, keep out of commits. Protected user instructions exceed the SESSION target and remain verbatim.

- Window-view goal remains active/incomplete;50-query post-update evaluation pending. [Prior view plan](../work/window-views/plan.md). Root concurrent chat/geo/provider work may postdate the snapshot; preserve it. Model429/latency observed in other runs; no uncontrolled concurrent paid batches.
- Build with explicit TAG before replacing pinned images. Root .env model credentials unchanged. Instructions remain verbatim despite SESSION target overflow.
- Сопоставление отелей и веб-фоллбэк (литера и строение в номере дома, 151 943 населённых пункта из PBF командой `ingest-settlements`, рабочий веб-поиск, карточка из публичной страницы с microdata в `/hotels/{id}/offers`): 27%→42% на 40 отелях, замеры, причины отказов и ограничения в [coverage-probe](../work/hotel-data/coverage-probe/README.md); источники помимо Островка — [research](../work/research/hotel-sources-beyond-ostrovok-2026-10-27.md). Коммиты `74ee9de`…`6fd59b1`, не пушил.
- Стенд: `hotel-web-card-20261027` (бэкенд), фронт `faster-search-20261027h`. Запрос про Трампа нестабилен (отель находится примерно в трети прогонов) — ограничение выдачи поиска, не кода. Ускорение поиска доведено: Казань 94→31 с, Сочи 131→64 с, Кострома пусто за 185–203 с → 20 отелей за 39 с, Эрмитаж 36 с. Запрос про Трампа теперь пуст за 54 с: пожелание закрывается, но итоговая проверка справедливо отклоняет цитату «the Ritz» без привязки к объекту — это пункт об идентичности, не о скорости. Таблицы и разбор: [work/web-search-fix/remaining.md](../work/web-search-fix/remaining.md).

- Поставщик, карточка, интерфейс, карта и свет сцены: решения в [design-decisions](../docs/design-decisions.md), числа в [evidence](../docs/evidence.md) и [catalog-match](../work/hotel-data/catalog-match/README.md). Ветка не пушилась.
- Не закоммичены чужие незавершённые правки в docs/*.md, context/README.md и work/README.md. В переписанном другой сессией docs/design-decisions.md осталась строка про удалённый поиск по прямоугольнику (`test_truncated_search_is_an_error...`) — убрать после их коммита.

