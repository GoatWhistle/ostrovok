# Ход выполнения

Ветка: `feat/hotel-agent-mvp`. Начало 2026-10-27, исходный SHA `63bef5f` (после rebase `26e0d45`).
Пользователь разрешил реализацию всего плана. После проверенного пункта локальный коммит;
push только после завершения всех E00–E18/H01–H07. По прямым просьбам пользователя ветка публиковалась
до завершения: `85bcd18..55c6b9a` и после E16 (см. [итог](result.md)).

| Этап | Статус | Доказательство / остаток |
|---|---|---|
| E00 | verified | `b1a46a1`: [исходная версия, стенд, API, данные](evidence/e00.md), кадры готовы; реальные фото/тарифы найдены в E12; реальный partial в срезе не найден; ограничение и повторный поиск [E13](evidence/e13.md) |
| H01 | verified | `520b990`: [Отчёт](evidence/h01.md): 400 тестов/36 правил, 8 браузерных комбинаций, реальная запись FakeLLM |
| E01 | verified | `d251e60`: [Отчёт](evidence/e01.md): 415 тестов, прямой GET, Back/Forward, фокус/scroll, 0 POST |
| E02 | verified | `e096665`: [Отчёт](evidence/e02.md): 416 тестов, 9 браузерных сценариев, тот же ввод/фокус при раскрытии |
| E03 | verified | `6070cdf`: [Отчёт](evidence/e03.md): 904 backend-теста; декодированные MVT; p95 126 мс на 120 измерениях |
| E04 | verified | `8d38a06`: [Отчёт](evidence/e04.md): WebGL до/после, дробные zoom, день/ночь, выбранный отель, quality 3 |
| E05 | verified | `d999184`: [Отчёт](evidence/e05.md): 422 теста, 10 переключений контроллера, 10 сохранённых источников, 0 POST |
| E06 | verified | `4544223`: [Отчёт](evidence/e06.md): матовые материалы, крыши, 424 теста, реальные город/берег/горы и мобильный вечер |
| E07 | verified | `e1650a1`: [Отчёт](evidence/e07.md): 426 тестов, 10 переключений, откат/повтор, URL/storage, камера и источники сохранены |
| E08 | verified | `e9fe521`: [Отчёт](evidence/e08.md): 428 тестов, 10 переходов, 30 с без фоновой работы, WebGL restore, главная/Back |
| E18 | verified | `a75bcc6`: [Отчёт](evidence/e18.md): 434 теста, тайминги/пауза/2 реальных submit, 8 сочетаний экранов, reduced motion и сбои загрузки |
| E12 | verified | `eba84ba`: [Отчёт](evidence/e12.md): 444 frontend/908 backend, 8 комбинаций и крайние данные |
| E10 | verified | `39f84d0`: [Отчёт](evidence/e10.md): 450 тестов, панель 1/3, отдельная страница, Back/Forward, прежний scroll/фокус/камера |
| E09 | verified | `78477d6`: [Отчёт](evidence/e09.md): 459 тестов, матрица16, реальный выбор маркера, 10 циклов, камера/стиль/scroll/фокус |
| E11 | verified | `a1331a5`: [Отчёт](evidence/e11.md): 488 тестов, ревью кода Codex, WebGL-маршрут на мини- и большой карте, 2 контекста, scroll 1200→1200, прямой вход, без WebGL |
| H02 | verified | `73ee995`: [Отчёт](evidence/h02.md): PATCH open/skipped, 409 для answered, сохранённый ответ и факты по provenance; 875 unit/contract + 41 integration, гонки на PostGIS, HTTP на стенде |
| H03 | verified | `a7b7779`: [Отчёт](evidence/h03.md): формы из `answer_fields` реестра, выбор не отправляет, типизированные исправления объектов; 516 тестов, FakeLLM на стенде |
| H04 | verified | `55f037c`: [Отчёт](evidence/h04.md): явный выбор, одинаковый сохранённый итог, вкладки по статусам API, отложение/возврат, общая блокировка; 525 тестов, стенд |
| H05 | verified | `1ef7132`, `2c15dcc` (даты): [отчёт](evidence/h05.md), 528 тестов, 375/1440/2560, шрифт 125%, browser zoom 200% |
| H06 | verified | `7c74500`: [Отчёт](evidence/h06.md): 529 тестов, 8 браузерных сочетаний, отмена/сворачивание/Escape/фокус |
| H07 | verified | `e041b58`: [Отчёт](evidence/h07.md): 15 находок, 22 контрола, 5 реальных мутаций, 45 integration и 3 e2e |
| E13 | verified | `33337b7`: [Отчёт](evidence/e13.md): 27 операций/42 схемы совпали с runtime, геометрия пакетами по 200 ID, фильтры подписей, карточка места на большой карте |
| E14 | verified | `e0333ce`: [Отчёт](evidence/e14.md), [аудит 5](../audits/frontend-5.md): 110 состояний, 70 axe-аудитов, 2 P1 исправлены |
| E15 | verified | `b96bc34`: [Отчёт](evidence/e15.md): настоящий GPU; смена оформления p95 54/125 мс (было 575–720), 10 циклов без накопления, скрытая карта 0 render; **панорамирование p95 ≤33 мс не достигнуто** в центре (167/100) и на берегу (50) |
| E16 | verified | `fab60cb`, `116a75d`: [Отчёт](evidence/e16.md): цепочки на GPU, слабой сети и без WebGL, кабинет с ошибкой и повтором, регрессия 12/12, e2e 23/23, 537 тестов; мобильный вид пропущен по решению пользователя |
| E17 | in_progress | Итог и push |

Подложка России скачана и проверена (13 315 380 122 байта, basemap-e9827062f2ba); исходник Protomaps 20261026,
bbox 19.6,41.1,180,82, zoom до 14. Файлы /mnt/e/o-hack-data/raw и /basemaps.
Журнал в основном дереве `work/russia-download/`; завершение определяется verify и manifest, не размером preallocated-файла.

Устаревшие e2e-сценарии (новый чат, мобильная вкладка «Отели», сравнение, длинные тексты на 320 px)
обновлены в E16; карточки мест проверены в E13, большая карта при увеличении текста — в E14.

## Хэши после rebase

2026-10-27 локальные коммиты переставлены поверх `origin/feat/hotel-agent-mvp` `85bcd18`
(15 коммитов напарника) и опубликованы по просьбе пользователя. В таблице выше новые хэши.
Отчёты этапов называют исходный HEAD до rebase; соответствие по теме коммита:

| До | После | Коммит |
|---|---|---|
| `024c6b9` | `520b990` | fix(frontend): protect hotelier drafts and fact mutations |
| `0662e10` | `e096665` | feat(frontend): reveal workspace after hotel results |
| `06dc025` | `6070cdf` | fix(backend): preserve buildings in overview tiles |
| `13a56c6` | `78477d6` | feat(frontend): add full viewport hotel map |
| `153b5b3` | `d251e60` | feat(frontend): model workspace navigation |
| `3cdb8de` | `d999184` | refactor(frontend): isolate map appearance packages |
| `48074a9` | `55f037c` | feat(frontend): clarify hotelier answer outcomes |
| `5d4fe0f` | `73ee995` | feat(api): persist deferred hotelier questions |
| `675e6d1` | `39f84d0` | feat(frontend): add expanding hotel panel and detail page |
| `6b79d11` | `a1331a5` | feat(frontend): show hotel location in a lightweight minimap |
| `7721ca4` | `e9fe521` | refactor(frontend): preserve map across workspace views |
| `8175edd` | `eba84ba` | feat(frontend): align hotel cards with customer requirements |
| `9cde5d9` | `a75bcc6` | feat(frontend): replace landing animation with two story sequence |
| `9fca676` | `b1a46a1` | docs(frontend): record evolution baseline |
| `a9296cc` | `a7b7779` | feat(frontend): use typed hotelier answer forms |
| `ca3fbb7` | `8d38a06` | fix(frontend): retain urban detail across map zooms |
| `dfef4c5` | `4544223` | feat(frontend): add toy town map appearance |
| `ead827c` | `e1650a1` | feat(frontend): switch map styles without losing state |
| `fc7e3cf` | `1ef7132` | refactor(frontend): focus hotelier workspace on questions |
| `8fdcb6b` | `91de568` | fix(frontend): handle skipped view transitions |
| `718af8b` | `e041b58` | test(frontend): cover hotelier recovery and navigation |
| `9febc6f` | `33337b7` | fix(frontend): complete map contract consumers |
| `d258689` | `e0333ce` | fix(frontend): refine workspace accessibility |
