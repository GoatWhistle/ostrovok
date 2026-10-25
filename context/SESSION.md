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
- Публикация ветки авторизована; референс Mapbox сохранён в work/design/source/.
- 2026-10-25: «делай план из ./work», «сначала запусти стенд», «надо еще запускать фронтенд на стенде», «продолжай», «напиши когда будет работать».
- 2026-10-25: «чет вообще нихуя не работает. Отель не показывается, карточки нет. Мой запрос вообще не показал ни одного результата», затем «Сделай нормальную карту, по ней вообще невозможно ориентироваться. Так же справа на русском напиши данные, без какого либо скора.»
- 2026-10-25: «подключи туда LLM. апи ключ уже должен быть»; пользователь повторно дал ключ Yandex Cloud. Ключ не копировать в файлы Git и выводы.

- 2026-10-25: «На фронте справа должна быть нормальная карточка товара, а не рандомный набор параметров. Также не смешивай англ и русский. Каждый найденный элемент из запроса пользователя при нажатии должен как то отобраться на карте, то есть допустим если пользователь искал бары, то он при нажатии должен видеть бары. Если он хотел до моря идти 5 минут, то при нажатии на карточке, ему показывался путь до моря 5 минут.»
- 2026-10-25: «давай запрос хочу 2х местный номер в сочи с круглосуточными магазинами».
- 2026-10-25: «тебе не надо сразу посчитывать все что есть. Пользователь может придумать все что угодно. Твоя задача чтобы агент выдавал по базовым характеристикам сразу из данных в бд, а по каким то своим пожеланиям вызывались тулзы. К примеру 2х местный номер это подсчитано заранее, а чтобы рядом находились какие то объекты, это лучше закинуть в тулзу».
- 2026-10-25: «нахуя ты создаешь какие то заранее подготовленные поля типа: бары рядом или круглосуточные поблизости. Пользователь может ввести абсолютно любую хуйню, хоть зоопарк а радиусе 10 км. Нет смысла зарнее что то зранить, это надо находить в моменте обработки зпроса».
- 2026-10-25: «Я имюе в виду что ты создаешь какую то локализацию, какие то поля во фронтенде: типа title_ru бары рядом.»
- 2026-10-25: «Пусть нейронка сама выводит что извлекает. Так же поставть deepseek v4.1 flash».
- 2026-10-25, скриншот блока «Об отеле и окружении»: «это вообще не надо показывать при запросе: хочу 2х местный номер в сочи с круглосуточными магазинами».

- 2026-10-25, дословно: «Сейчас расскажу как это должно работать и ты должен будешь делать это пока не сделается и ты не проверишь минимум на 20 запросах:

Пользователь вводит запрос
модель валидирует, исправляет орфографические и логические или даже географические ошибки
далее она извлекает каждую хотелку пользователя и пытается найти отели которые им удовлетворяет в наибольшой мере
выдает список самых релевантных отелей, где помечены какие хотелки были найдены
при нажитии камера перемещается на место этого отеля, справла появляется карточка
на карточке при наведении хотелку на карте как то должно отобраться объяснение как это было выбрано».
- 2026-10-25: «Также сделай приятную карту, с каким то цветами, рельефом, солнцем, закатом, чтобы вообще можно было выбрать дату и посмотреть погоду или где солнце находится. Можешь рисовать вообще полностью с нуля через WebGL».
- 2026-10-25, дословно: «сделай справа как чат, а слева буду отели рекомендоваться
и так же слева в этой плашке при выбора отеля будет его карточка высвечиваться

то есь надо еще поддержку чата и контекста сделать. Так же в карточке отеля надо показывать всю его информацию. Какие там есть номера, сколько стоят, на каком этаже, с какой стороны, что включено, может краткое саммари по отелю делать. Также рисуй все здания рядом в 3д».
- 2026-10-25: «посмотри логи последнего запроса. Почему не работает».
- 2026-10-25: «Надо еще брать данные по отелям, номерам, услугам. Желательно еще знать на каком этаже номер, что в него включено. Возможно есть ли там бассейн, все в включено и тп. Желательно брать апишку, чтобы понимать какие номера свободны и на какой день».

- 2026-10-25 (фронт, Factmap): «теперь давай переделаем весь сайт под эту дизайн систему. надо делать идеально по ней»; «дизайн система один в один, должна быть она у нас идеальная её не ломай»; «делай периодически pull … улучшаем наш сервис под его обновления»; «обнови ридми … проверь фавиконы … фото для соц сетей, когда это сделаешь все сделай коммит и пушь в его ветку, разрешаю».

## Current state

- Factmap redesign merged on top of this branch (lead frontend session): brand Factmap, approved HTML design system `work/design/factmap-design-system.html` (source `work/design/system/`, extended with chat, states and 404), all screens on DS tokens; chat UI `features/search-chat` uses the persistent chat API; hotel card shows rooms and offers in DS; 404 «Этого места нет на карте»; favicons/PWA/OG regenerated (`npm run brand:assets`); README rendered in product style. `npm run verify`: 36 rules, 310 tests, build.
- Branch `feat/hotel-agent-mvp`, supplier-offers commit `bb03302` (Git HEAD while updating this note). ETG/RateHawk Hotelpage adapter, verified hotel-ID mapping table and date-based `/hotels/{id}/offers` are implemented. RU/EN card selects dates and guest count; no ETG keys or mappings are present, so stand returns honest `provider_unavailable`. Static Content API sync and pool/room services remain pending source access. Browser 375/1440 px checked; 10/10 Playwright; frontend verify 36/310/build; backend 232 tests, Ruff/mypy/import-linter. See `work/research/hotel-inventory.md`.
- Branch `feat/hotel-agent-mvp`, timeout-fix commit `113ac67` (Git HEAD while updating this note). Compose on localhost:8080/8000 uses DeepSeek V4.1 Flash through ignored `.env`; backend rebuilt after retry fix.
- Added PostgreSQL chat history, contextual query rewrite, RU/EN answers grounded in search results; right chat, left recommendations and selected hotel card, center map. Card reads real rooms/facts and shows honest empty state because `rooms` has 0 rows. Nearby buildings in 350 m are all extruded; OSM floor heights and estimated fallback are marked.
- Live stand: initial query returned 20 shown candidates; follow-up retained three wishes; GET restored four messages. Scene for `n10058556917`: 512 neighboring buildings, 512 volumes, 161 with OSM levels. Prior `work/evals/search-22-results.json`: 22 search queries, 16 with results.
- `npm run verify`: 36 rules, 310 tests, build. Backend after timeout fix: Ruff, mypy, import-linter, 226 tests. Full Playwright from prior turn: 10/10, including 1440/375/320, both themes/languages, long text.

## Next actions and pitfalls

- Await provider name and partner credentials (request sent asynchronously). Do not use Yandex LLM key as hotel supplier key. For ETG, obtain Content API permission, verify OSM-to-ETG hotel mappings, then sync hotel/room/amenity catalog offline; only then live offers can appear. `rg_ext.floor` is floor type, not a numeric room floor. Do not fabricate exact floor, pool or all-inclusive.
- Timeout fix committed and pushed. If user provides the exact failed message, replay it through the live stand. Watch for a room/pricing source answer and connect it if provided.
- User was asked asynchronously for a source of room inventory and prices; no answer received. Do not invent or seed rooms. Current UI displays unavailable fields.
- One transient Yandex ConnectError occurred on the first live chat request; a single automatic retry was added and tested. Failed send preserves draft. Secrets remain only in ignored `.env`.
- Последний пользовательский POST `/chat/messages` в 09:49:45 UTC завершился 503 после 30-секундного `ReadTimeout` Yandex Cloud. Запрос не сохранился. Добавлен повтор `ReadTimeout`; тест сначала падал, после правки проходит. Контрольный живой запрос через frontend вернул 200 за 3,66 с. Точный текст неуспешного сообщения не логируется; пользователь был запрошен асинхронно.
- Бюджет SESSION 6000 символов превышен из-за защищённых дословных инструкций пользователя; их не сокращать.

## 2026-10-25: обновление стенда и Nuitee

- Пользователь дал тестовый ключ Nuitee Connect; секрет записан только в игнорируемый `.env`.
- 2026-10-25, дословно: «спуль и сразу перезапусти стенд, там новый фронт».
- Ветка `feat/hotel-agent-mvp`, исходный SHA после pull `90d5433`; подтянут Factmap frontend,
  образы пересобраны и Compose backend/frontend перезапущены. Обе службы healthy, HTTP 200.
- Подключён Nuitee sandbox для проверки дат; `2001` переводится в `no_offers`, не в «мест нет».
  Метка sandbox видна на фронте. Один вручную подтверждённый матч City Park Hotel
  `n736761646` ↔ `lp552d8` (13 м) синхронизирован: 8 реальных категорий номеров, без
  выдуманного этажа, цены и остатка. API карточки отдаёт 8; ответ тарифов на 2026-11-15
  возвращает `no_offers` и `sandbox=true`. Подробности в `docs/evidence.md`.
- Миграция `20261025200000_unknown_room_floors.sql` применена. Frontend verify: 36 правил,
  310 тестов, сборка. Backend unit/contract: 235; integration: 1. Ruff, mypy и import-linter
  проходили до последней небольшой правки форматирования/факта; повторить финальный прогон.
- Следующее: завершить визуальную проверку 375/1440 px, перепроверить сборку/тесты после
  правок, обновить SHA после коммита и push. Для Сочи sandbox пока не дал тарифов; больше
  OSM-отелей нужно сопоставлять вручную. Не утверждать о фактической доступности номеров.
