# Контракты при переходе на неоновый дизайн

Дата проверки: 2026-10-26. Приложение к [спеке](spec.md).
Источник формы ответов — [OpenAPI](../../docs/api/openapi.yaml), база `feat/hotel-agent-mvp` / `ae7d23f`.

## 1. Что проверено

В файле контракта **24 операции и 37 именованных схем**. Сопоставлены пути OpenAPI, запросы фронтенда, регистрация HTTP-обработчиков и ветки после `git fetch origin`. Наличие обработчика не означает, что весь его сценарий был заново проверен на стенде.

На текущем стенде `http://localhost:18083/openapi.json` зарегистрировано 20 операций; `/api/v1/health` вернул 200. Четыре оставшиеся операции найдены в другой ветке вместе с бизнес-логикой, SQL-репозиториями, подключением в `composition.py` и интеграционными тестами.

| Проверенная ветка | SHA | Четыре операции отельера/фактов |
|---|---|---|
| `feat/hotel-agent-mvp` / `origin/feat/hotel-agent-mvp` | `ae7d23f` | В текущем backend не подключены |
| `feat/hotel-frontend` / `origin/feat/hotel-frontend` | `9c09941` | Реализованы; источник переноса |
| `origin/feat/per-wish-agent-loop` | `a422515` | Реализация не найдена |
| `origin/fix/stand-agent-integration` | `272ccd3` | Реализация не найдена |
| `origin/fix/window-view-recommendations` | `e47c3f2` | Реализация не найдена |
| `main` / `origin/main` | `72757ea` | Шаблон без этих операций |

Доказательства в исходной ветке: [HTTP-обработчики](https://github.com/GoatWhistle/o-hack/blob/9c099417e76541a6e51fa4c72f0160d1703d7bc9/backend/src/hotel_agent/interfaces/http/routers/hotelier.py), [подключение](https://github.com/GoatWhistle/o-hack/blob/9c099417e76541a6e51fa4c72f0160d1703d7bc9/backend/src/hotel_agent/composition.py), [проверки хранения и конкуренции](https://github.com/GoatWhistle/o-hack/blob/9c099417e76541a6e51fa4c72f0160d1703d7bc9/backend/tests/integration/test_workspace.py).

По указанию пользователя **повторная разработка этих функций не планируется**. Их перенос и адаптация к текущему backend описаны в разделе 5 основной спеки. Текущий результат — только документы; перенос кода и миграции предстоят.

## 2. Матрица 24 существующих операций

Пути ниже имеют префикс `/api/v1`. Для JSON применяются общие проверки раздела 5. «Сохранить» означает сохранить контракт и поведение при изменении оформления, а не обещание, что реализация полностью проверена сейчас.

| № | operationId и запрос | Потребитель / что сохранить | Особые проверки |
|---|---|---|---|
| 01 | `health` — GET `/health` | Состояние сервиса; `status`, `llm_provider` | Недоступность API не выглядит успешным подключением; служебные данные не превращаются в настройки пользователя |
| 02 | `listRegions` — GET `/regions` | Регион поиска и начальная камера; `items`, bbox, дата данных | Пустой список, выбранный регион исчез, камера вне bbox; регион не задаётся массивом в UI |
| 03 | `listCharacteristics` — GET `/characteristics` | Названия фактов, группы сравнения, единицы и типы подсветки | Неизвестный ключ/иконка, nullable compare, `better=lower/higher/null`; цвет метаданных отображается через семантические роли |
| 04 | `searchHotels` — POST `/search` | Запрос, region_id/bbox, limit/cursor/compute_missing; результаты, parsed, viewport, pending, next_cursor | 0 результатов; pending без готового значения; следующая страница без дублей; отмена устаревшего запроса; исправление запроса показано пользователю |
| 05 | `getConversation` — GET `/chat/conversations/{conversation_id}` | История сообщений и связанный search/effective_query | 404 удалённого диалога, история без search; восстановление найденных отелей, а не только текста |
| 06 | `renameConversation` — PATCH того же пути | Изменение title и updated_at | Пустое/слишком длинное имя, 404/422; ошибка сохраняет прежний заголовок |
| 07 | `deleteConversation` — DELETE того же пути | Удаление диалога и корректный переход в workspace | **204 без JSON-тела**, 404; сброс активного ID и согласованность локальной истории |
| 08 | `sendChatMessage` — POST `/chat/messages` | conversation_id/message/region_id/selected_hotel_id/locale; ответ Conversation | Сохранить текст при ошибке; исключить двойную отправку; реальный ответ 200, без придуманного SSE-протокола |
| 09 | `getHotelCard` — GET `/hotels/{hotel_id}` | Отель, rooms, facilities_ru/en, facts, conflicts, stale_count, open_questions, camera | 404; нет фото/комнат/удобств; частичные поля; после мутации факты и счётчики обновлены |
| 10 | `getHotelOffers` — GET `/hotels/{hotel_id}/offers` | check_in/check_out/adults/residency; статусы, цена/валюта, sandbox, source, checked_at | Неверные даты/гости → 422; все пять статусов; null floor/available_rooms; ошибка провайдера не означает «нет номеров» |
| 11 | `getHotelScene` — GET `/hotels/{hotel_id}/scene` | context_radius_m; корпуса, окружение, фасады, камеры, terrain | Пустая геометрия, несколько корпусов, склон, неизвестная высота, 404; смена отеля отменяет прежнюю сцену |
| 12 | `getFact` — GET `/hotels/{hotel_id}/facts/{fact_id}` | Факт, provenance, qualifiers, history, conflicts | Чужой hotel_id → 404; старый superseded ID остаётся доступен в истории; все источники и статусы |
| 13 | `getGeoFeatures` — POST `/geo-features:batch` | ids → GeoFeatureCollection; маршруты/POI/полигоны/фасады | ≤200 ID на запрос, дедупликация, недостающий ID, пустой ответ; >200 ссылок разбиваются на пакеты, не теряются молча |
| 14 | `getMapCatalog` — GET `/map/catalog` | version/classes; классификация объектов для нового рендера | Сейчас нет полноценного потребителя карты; добавить Query. Неизвестный class/style/prop имеет безопасное представление своего слоя |
| 15 | `getMapTile` — GET `/map/tiles/{z}/{x}/{y}.pbf` | Бинарный MVT, слои и свойства классов/высот | Проверять Content-Type и декодирование; пустой валидный тайл отдельно от 404; version/cache; дополнить описание семи слоёв |
| 16 | `getTerrainTile` — GET `/map/terrain/{z}/{x}/{y}.png` | DEM для рельефа и посадки зданий | PNG и поддерживаемый диапазон z; 404/пустота → согласованный плоский режим; ореол не влияет на геометрию |
| 17 | `getReliefTile` — GET `/map/relief/{z}/{x}/{y}.png` | Существующий raster-контракт сохранить | Текущий UI использует color-relief из DEM, отдельный обязательный запрос добавлять не нужно; endpoint проверяется как совместимый API |
| 18 | `getWeather` — GET `/weather` | lat/lon/date/hour; available/unavailable, nullable параметры, reason/source | Нулевая температура — значение; null — отсутствие; unavailable не рисует солнечную погоду; быстрый выбор часа не подставляет старый ответ |
| 19 | `compareHotels` — POST `/compare` | 2–5 hotel_ids, optional characteristic_keys; порядок rows/cells | 1/6 ID, дубликаты, неизвестный отель/ключ; пропуски не сравниваются как ноль; направление преимущества берётся из реестра |
| 20 | `getPlace` — GET `/places/{place_id}` | from_hotel, tags/source/facts/walk; карточка места и маршрут | 404, null name/walk; graph/straight различимы; ODbL и дата источника; query key включает отель |
| 21 | `listHotelierQuestions` — GET `/hotelier/{hotel_id}/questions` | Очередь вопросов кабинета; готовая реализация из другой ветки | Пустая очередь, 404, reasons missing/conflict/stale/low_confidence и статусы open/answered/skipped |
| 22 | `answerHotelierQuestion` — POST `/hotelier/questions/{question_id}/answer` | text → question_id/extracted/conflicts/follow_up; перенос готовой логики | Нераспознанный ответ сохраняет открытый вопрос; цитаты и конфликты сохраняются; повтор/конкуренция не создаёт второй факт |
| 23 | `confirmFact` — POST `/facts/{fact_id}/confirm` | Подтверждение существующего факта; перенос готовой логики | 404; недопустимый переход → 422; сохранение происхождения; повтор и подтверждение superseded/computing определены явно |
| 24 | `correctFact` — POST `/facts/{fact_id}/correct` | value/comment → Fact; перенос готовой логики | Проверка типа по реестру; новый ID и сохранённая история; rollback ошибки; один актуальный победитель при одновременных правках |

Текущие frontend-потребители: `entities/hotel/hotel.queries.ts`, `fact.mutations.ts`, `entities/hotelier/hotelier.queries.ts`, `entities/catalog/`, `entities/comparison/`, `entities/place/`, `entities/health/`, `features/hotel-search/use-conversation.ts`, `features/hotel-map/use-weather.ts`, источники в `shared/geo/`.

Особенности, которые учесть при переносе: `useGeoFeatures` сейчас делает `.slice(0, 200)`; заменить потерю хвоста пакетной загрузкой. `residency="ru"` и `context_radius_m=350` сейчас фиксированы: если они становятся изменяемыми, добавить их в Query key. Сохранить нынешнее поведение, пока соответствующих пользовательских контролов нет.

## 3. Поля всех 37 схем

Схема/поле не обязаны иметь отдельный виджет. Они должны иметь определённого потребителя, безопасную обработку отсутствия и проверку, чтобы редизайн не потерял смысл ответа. Inline-ответы health, списка регионов/характеристик, compare, очереди/ответа отельеру покрыты матрицей выше.

| Схемы | Что нельзя потерять |
|---|---|
| `Error` | code/message, HTTP-статус, локализованный текст; без SQL/секретов в UI |
| `LonLat`, `BBox`, `Camera` | Порядок lon/lat, границы, center/zoom/pitch/bearing, duration_ms, target_alt_m, range_m, focus_facade_id; reduced motion меняет переход, не целевую камеру |
| `Region` | id/name/bbox/hotels_count/data_as_of/default_camera; дата данных не подменяется сегодняшней |
| `Characteristic` | key/title/description/value_type/unit/scope/ttl_days/source_kinds; compare.group/better; display.icon/color/geo_style, неизвестные расширения |
| `SourceType`, `Provenance` | Все семь source types; source_ref/url, method, confidence, observed_at/computed_at/valid_until, evidence; confidence не превращается в «точность системы» |
| `FactStatus`, `FactBrief` | Все шесть статусов, fact_id/characteristic_key/value/unit/label/confidence/source_type/status/geo_refs; false/0 не скрываются |
| `Fact`, `FactDetail`, `Conflict` | Наследуемые поля FactBrief через allOf, subject/qualifiers/explanation/provenance; история, fact_ids, resolution/winner_fact_id/rule; неизвестное значение и конфликт не получают success-цвет |
| `SearchRequest`, `ParsedIntent`, `QueryCorrection` | query/region_id/bbox/limit/cursor/compute_missing; characteristic_key/op/value/weight/required/source_text; original/corrected/reason |
| `MatchedProperty` | match/label/explanation/fact/geo_refs/camera, отдельно full/partial/none/unknown/computing; unknown не подменяется ложным отрицанием |
| `HotelSummary`, `SearchResult`, `SearchResponse` | id/name/stars/address/location/building_id/height_m/levels/thumbnail_url; score/matched/camera/footprint; query_id/parsed/results/viewport/pending/next_cursor/took_ms |
| `BuildingFeature`, `Facade`, `HotelScene` | Polygon/MultiPolygon, stable IDs, высоты и их отсутствие, hotel_id/is_hotel/min_height_m/ground_elevation_m/roof_shape/height_fact_id; azimuth/label/geometry/facts, корпуса/окружение/камеры/terrain |
| `GeoFeature`, `GeoFeatureCollection` | type/id/geometry/properties; kind/characteristic_key/name/label/osm_ref/style_hint/place_id/hotel_id/distance_m/minutes/mode; пустая коллекция и порядок координат; геометрия не пересоздаётся из декоративных координат |
| `MapCatalog`, `MapClass` | version/classes; key/layer/match/priority/min_zoom/style/props. Четыре яруса ground/volume/prop/poi и приоритет сохраняются, стиль не исполняет произвольный код из полей |
| `PlaceCard` | id/name/kind/location/osm_ref/tags/source/facts/walk; source.type/extracted_at/license/url; walk.distance_m/minutes/geo_ref/mode, nullable walk/name/minutes |
| `Weather` | status/reason/date/hour/temperature_c/cloud_cover_pct/weather_code/source; недоступность и ноль различаются |
| `HotelCard` | hotel/rooms/facilities_ru/facilities_en/facts/conflicts/stale_count/open_questions/camera; inline rooms: id/name/capacity/floor_range/facade_ids/price_amount/price_currency/included/facts |
| `HotelOffers`, `RoomOffer` | hotel_id/check_in/check_out/adults/status/source/sandbox/checked_at/offers; room id/name/price_amount/price_currency/available_rooms/meal/amenities/floor_number |
| `ChatRequest`, `ChatMessage`, `ConversationTitle`, `Conversation` | Поля запроса, locale/selected_hotel_id; сообщения id/role/content/created_at; title; conversation id/title/updated_at/messages/effective_query/search |
| `HotelierQuestion` | id/hotel_id/characteristic_key/text/reason/status/created_at; результат ответа не скрывает follow_up или conflicts |

`HotelOffers.status` проверяется для available, no_offers, provider_unavailable, hotel_unmapped и provider_error. `FactStatus` — active, conflicted, superseded, confirmed_by_hotelier, stale, computing. Иконка/цвет не заменяют подпись статуса.

Вложенный `SearchResponse.parsed` также входит в покрытие: intents, unmatched_terms, location_hint, anywhere, normalized_query, corrections, unsupported_region, needs_clarification, wants_room, room_preferences_unrestricted, budget, check_in, check_out, adults. Нельзя потерять уточнение региона или ограничения номера при новом оформлении чата.

## 4. Расширения для неоновой карты: проект контрактов

Это **план**, этих endpoint сейчас нет. Расширения добавляются сначала в OpenAPI, затем реализуются и проверяются, после этого генерируются frontend-типы. Старые операции сохраняют имена, формат и смысл. При N2 допускается обоснованное упрощение metadata в существующий `/map/catalog`, если оно сохраняет все перечисленные обязанности без дублирования источников.

### 4.1 GET `/map/style?region_id=sochi`

Задача: клиент получает согласованную версию картографических данных и адреса локальных ресурсов, не строит их по случайным константам галереи.

Предлагаемый `MapStyleManifest`: `region_id`, `available`, `reason` nullable, `bbox`, `version`, `catalog_version`, `tiles_version`, `assets` nullable, `capabilities`. В assets: versioned `basemap_url`, `glyphs_url`, `sprite_url`, собственные `vector_tiles_url`, `terrain_tiles_url`, диапазоны zoom. Capabilities сообщают наличие terrain и render scene, а не характеристики отелей. Все адреса локальные/same-origin.

- Известный регион без картографических данных: 200, available=false, reason и assets=null. Неизвестный region_id: 404 Error; неверная форма запроса: 422 Error.
- Для available=true все обязательные ресурсы существуют и относятся к одной версии. UI получает пресет стиля из токенов приложения; metadata не передаёт произвольный CSS.
- Query key включает region_id; ответ кэшируется 5 минут. Несогласованность версии сцены вызывает обновление manifest и один повтор, без бесконечного цикла.

### 4.2 GET `/map/scene?region_id=sochi&bbox=west,south,east,north&zoom=16&v=…`

Задача: ограниченная выборка **полных контуров** фоновых зданий для окон. Этот ответ не заменяет подробную сцену выбранного отеля.

Предлагаемый `MapRenderScene`: `region_id`, `version`, `bbox`, `features`, `truncated`, `eligible_count`. Features — `MapRenderBuilding`: GeoJSON Feature с обязательным stable `id`, Polygon/MultiPolygon и properties: `building_id`, `hotel_id` nullable, `class`, `class_source`, `height_m` nullable, `levels` nullable, `height_source`, `render_height_m`, `height_estimated`, `min_height_m`, `ground_elevation_m` nullable, `ground_source` nullable.

- Bbox валиден в WGS84: west<east и south<north, широта/долгота в своих диапазонах. Запрос ограничен регионом и площадью ≤4 км²; zoom16–19. Неверные параметры/слишком большая площадь → 422 Error.
- Пересекающие bbox здания возвращаются целиком с отверстиями. До 800 зданий / 100 000 вершин / 300 КБ gzip; выбор детерминирован по расстоянию к центру и ID. Превышение даёт truncated=true, а не случайный обрыв JSON. Слишком сложная отдельная геометрия пропускается с учётом eligible_count.
- `height_m` остаётся исходной высотой; условная высота явно отделена в render_height_m/height_estimated и не создаёт Fact. Неизвестная отметка земли остаётся null, клиент получает её из того же DEM или выбирает плоский режим.
- Неизвестный регион → 404; неподдерживаемая версия → 409 Error с code `map_version_changed`; нет зданий → 200 с пустыми features. Внутренний сбой → 5xx Error, базовые объёмы остаются видны.
- Клиент запрашивает после moveend с debounce150 мс, максимум два запроса одновременно, AbortSignal при новом viewport. Большой viewport делится на ограниченные bbox; кэш ≤8 областей и ≤16 МБ, объединение по stable ID и общий предел геометрии. При превышении бюджета остаётся обычный MVT-объём.
- Выбранный отель имеет приоритет; его корпус исключается из фоновых окон/двойной экструзии по тому же building_id. Версия и region_id включены в Query key.

### 4.3 Совместимые изменения и статические ресурсы

- Документировать все семь MVT source-layer и их свойства; сейчас описание контракта перечисляет старый набор. Добавить stable building_id и согласованные render height/min-height метаданные там, где их использует базовая экструзия. MVT id и GeoJSON id обозначают один исходный объект.
- В `BuildingFeature.properties` добавить отсутствующие сведения об источнике/условности высоты как optional поля. Уточнить nullable для реально отсутствующих измерений; клиент не применяет non-null assertion к таким полям.
- Указать optional version query для MVT/scene и стратегию переключения снимка. Нельзя отдавать новый набор под URL старого immutable cache. Cache key учитывает полный URI; старые query без v остаются совместимыми с текущим набором.
- PMTiles: Range206, правильные Content-Range/Accept-Ranges/Content-Length, ETag; отсутствующий файл → 404, неподходящий диапазон → 416. URL `/maps/…` не должен возвращать HTML приложения. Glyphs/sprites: правильный MIME, локальность, лицензия и версия.
- JSON `Error` документирует 404/422/503 для переносимых операций и 409 для новой сцены. Не описывать FastAPI detail-ответ как допустимую альтернативу существующему envelope.
- При переносе уточнить `required: [value]` для тела correctFact и ограничения длины text/comment: текущий YAML недостаточно явно описывает валидацию готовой реализации исходной ветки. При этом false и 0 остаются допустимыми значениями подходящего типа.

## 5. Проверки и доказательство покрытия

1. **Инвентарь:** автоматически получить пары method/path из YAML и runtime OpenAPI. После переноса функций должны совпасть все 24 существующие операции; после утверждённых расширений карты — весь новый набор. Проверка только `served ⊆ documented` недостаточна.
2. **Форма:** success/error ответы каждой JSON-операции валидируются по опубликованной схеме, включая allOf, required, enum, null и inline-модели. Для бинарных операций — реальное декодирование MVT/PNG и заголовки. 204 не декодируется как JSON.
3. **История и запись:** реальные PostgreSQL-тесты миграций/rollback, чтение после ответа/подтверждения/исправления, полный provenance, конфликт и superseded history, конкурентные операции. Существующие тесты исходной ветки адаптировать, не заменять только mocks HTTP.
4. **Кэш:** после мутаций инвалидировать карточку, факт/историю, вопросы, поиск/сравнение и связанные снимки там, где они читают изменённое значение. Старый асинхронный ответ не переписывает выбранный отель/час/диалог.
5. **Границы:** неизвестный ID, отсутствующее поле, null/false/0, пустой список, максимальная пачка, некорректный bbox/дата/тип, 404/422/503, ошибка сети/тайла, быстрый повтор действия. Не все опциональные поля обязаны быть видны одновременно, но ни одно используемое поле не теряется в преобразовании.
6. **UI:** каждое состояние из матрицы видно в RU/EN, обеих темах и на 375/1440. Реальные данные — в приложении; тестовые ответы — только в tests. Детерминированный провайдер, платные запросы не нужны.

На этапе подготовки документа выполнены инвентаризация YAML, проверка регистрации текущего стенда и поиск готовой реализации по веткам. Эта сверка подтверждает полноту **плана покрытия**, а не завершение редизайна или переноса.
