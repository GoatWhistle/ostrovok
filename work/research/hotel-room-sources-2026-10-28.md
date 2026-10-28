# Источники данных по отдельным номерам отеля

Проверено 28 октября 2026 года. Проверялись официальные спецификации API, `robots.txt`, тарифные
страницы и фактический HTML/JSON публичных страниц. Регистрации, создание ключей, использование
чужих ключей, платные вызовы и обращения к поставщикам не выполнялись. HTTP-проверки — единичные
`curl`-запросы без обхода пагинации; для каждой ниже указаны URL, код ответа, размер ответа и дата.
Отдельно измерялись публичные ответы Островка, которые продукт уже читает: карточка отеля,
`multicomplete` и `hp/search`. Разделение: **задокументировано** (написано в спецификации
поставщика), **измерено мной** (получено запросом 2026-10-28), **заявлено поставщиком** (его
утверждение без возможности проверки).

Задача: где взять данные по конкретным категориям номеров — название, площадь, спальные места,
вместимость, **этаж**, **ориентацию окна и вид**, оснащение, фотографии именно этого номера и цену
на даты. Главный дефицит продукта: карточка обещает вид из окна, а данных об этаже и стороне
комнаты у нас нет совсем.

Что уже установлено прошлыми исследованиями и здесь не повторяется:
`work/research/hotel-inventory.md` (Nuitee sandbox, ETG Hotelpage, Booking Demand API),
`work/research/free-hotel-data-2026-10-26.md` (OSM/Geofabrik, Wikidata, JSON-LD на сайтах отелей),
`work/research/hotel-providers-russia-2026-10-26.md` (барьеры доступа Яндекс Путешествий,
Bronevik, ETG, TravelLine, 2ГИС, 101Hotels),
`work/research/hotel-sources-beyond-ostrovok-2026-10-27.md` (отельный уровень: 101hotels и Alean
как fallback, реестр Росаккредитации, Travelpayouts, карты и справочники, Росстат, заполняемость
OSM-тегов), `work/hotel-data/ostrovok-rooms/verification.md` и `work/hotel-data/free-mode.md`
(что уже реализовано и режим `HOTEL_DATA_MODE=free`).

Одно прошлое утверждение этой проверкой **опровергнуто**: в заметке от 27 октября сказано, что у
Alean нет «структурированного списка категорий номеров». На измеренных карточках такой список есть,
причём с полями «Вид из номера» и «Этаж» — см. раздел «Alean».

## Что использовать первым

**1. Публичная карточка Alean — единственный измеренный бесплатный источник, который даёт
ориентацию окна и этаж по категории номера.** На карточке
[«Острова», Сочи](https://www.alean.ru/hotels/rossiya/krasnodarskiy_kray/sochi_gorod-kurort/sochi_tsentralnyy_rayon/ostrova_spa-otel/)
(HTTP 200, 456 800 байт, 2026-10-28) 16 категорий номеров, у 14 заполнено поле **«Вид из номера»**
со значениями `на море`, `на парк: на море`, `на бассейн: на парк`, `на город`, у двух — отдельное
поле **«Этаж» = 4**, ещё у трёх этаж вынесен в название («Люкс 2-местный 2-комнатный (4 этаж)»).
У каждой категории также «Площадь (кв. м)», «Кол-во основных мест», «Кол-во доп. мест»,
«Количество комнат», «Тип номера», мебель, оборудование, санузел и сервис. Разметка — серверная
таблица «подпись/значение» с устойчивыми классами `productTwoColsList-firstCol` /
`productTwoColsList-lastCol`, то есть разбирается детерминированно, без LLM и эвристик.

Почему первым: это ровно то поле, которого нет ни у Островка в публичном ответе, ни в Nuitee, ни в
Hotelbeds, ни в Amadeus, ни в Яндекс Путешествиях — ни бесплатно, ни за деньги в виде номера этажа.
Доступ не требует ключа, аккаунта и платы; `robots.txt` карточки не запрещает; объём по России —
20 665 URL (прошлая проверка), 11 567 карточек объектов.

**2. Публичная карточка 101hotels — лучший бесплатный источник по составу номерного ряда и
фотографиям номеров.** На карточке
[«Лучезарный Резорт», Сочи](https://101hotels.com/main/cities/sochi/luchezarniy_rezort.html)
(HTTP 200, 2 105 315 байт, 2026-10-28) 19 категорий (`data-room-id`), у каждой площадь
(«Площадь номера 21м²»), тип кровати, число спальных мест, оснащение и 10–46 ссылок на фото
именно этой категории на `s.101hotelscdn.ru`. Вид и этаж здесь не отдельные поля, но присутствуют
как теги оснащения в группе «Вне помещения»: `вид на море`, `вид на бассейн`, `вид на парк`,
`красивый вид`, `балкон`, `терраса` и — измерено — `номер расположен на первом этаже`. Вид также
закодирован в названии категории: «Студио (С видом на море)», «Делюкс (С видом на парк)».

**3. Бесплатные поля, которые Островок уже отдаёт, а мы не извлекаем.** Это нулевая интеграция,
только парсинг (см. «Островок: что лежит в уже читаемых ответах»): `starCertificate.certificateId`
(номер реестровой записи Росаккредитации) в JSON карточки отеля, `occupancy` и
`bed_places.main_count` / `extra_count` / `child_cot_count` плюс `multi_bed_data` в ответе
`hp/search` (вместимость по тарифу), код оснащения `with-view` и видовые токены в названии
категории.

Чего бесплатно нет нигде: **азимут окна, номер конкретной комнаты и её этаж как структурированное
поле массово**. Alean даёт этаж точечно (2 из 16 категорий в измеренном примере), 101hotels — как
текстовый тег. Единственный задокументированный интерфейс с реальным этажом физической комнаты —
PMS-метод TravelLine `obtain-accommodation-inventory`, и он требует подключения, созданного самим
отельером.

## Сводная таблица

| Источник | Плата и ключ | Поля по номеру | Покрытие РФ | Ограничения |
|---|---|---|---|---|
| Alean, публичная карточка | Без ключа и платы; лицензии на контент нет | Название, тип, **вид из номера**, **этаж** (точечно), площадь, основные и доп. места, число комнат, мебель, оборудование, санузел, сервис | 20 665 URL по России, 11 567 карточек | Фото номеров в HTML нет (галерея грузится скриптом); этаж заполнен не у всех категорий; цены на даты нет; текст и фото не под открытой лицензией |
| 101hotels, публичная карточка | Без ключа и платы; лицензии на контент нет | Название с видом в скобках, площадь, кровати, число спальных мест, оснащение с тегами `вид на море`/`номер расположен на первом этаже`, 10–46 фото на категорию | На странице Сочи 25 карточек, на `/onmap` — 37; национальный объём не подтверждён (sitemap 404) | Цена на даты только через `/search`, закрытый в `robots.txt`; вид и этаж — текстовые теги, не поля; фото с `creditText: 101Hotels.com` |
| Островок, публичная карточка и `hp/search` | Без ключа и платы | `rgHash`, название, `beddingType`, `size`, оснащение, фото категории; в тарифах — цена на даты, `allotment`, `occupancy`, `bed_places`, `multi_bed_data`, питание, дедлайн отмены | Используется в продукте; в измеренной проверке сопоставилось 5 из 20 отелей | Ни этажа, ни кода вида: в `roomGroups` только `nameStruct`/`roomAmenityData`/`size`/`images`; в `hp/search` слов `view`/`floor` нет вообще |
| ETG/RateHawk Content API | Партнёрские реквизиты; Content API по отдельному запросу; `size` — по доп. соглашению | `rg_ext.view` — **40 кодов вида** (на море, на Кремль, на закат, панорамный…), `rg_ext.floor` — тип этажа, не номер; `bedding`, `capacity`, `bedrooms`, `balcony`, `bathroom`, `class`, `quality`, `room_amenities`, `images_ext` с категориями | Российский каталог Островка | Внутренний контент (фото, описания) индексировать строго запрещено; `size` недоступен в дампах; доступ не самообслуживаемый |
| Nuitee LiteAPI `/data/hotel` | Content endpoints бесплатны при fair use; production-ключ требует карты | `roomName`, `roomTitle`, `description`, `roomSizeSquare` + `roomSizeUnit`, `maxAdults`/`maxChildren`/`maxOccupancy`, `bedTypes` (quantity/bedType/bedSize), `attributes`, `roomAmenities`, `photos` с `imageDescription` | Каталог Nuitee; по РФ не подтверждено | Поля вида и этажа нет; fair use и look-to-book остаются условием |
| Hotelbeds Content API | Регистрация бесплатна; evaluation-ключ — **50 запросов в сутки**, дальше 403 | `roomCode`, `description`, `characteristicCode`, `minPax`/`maxPax`/`maxAdults`/`maxChildren`, `roomFacilities` (коды с `indFee`), `roomStays`; фото привязаны к `roomCode` | Не проверялось | Площади номера нет; поля вида и этажа нет; 50 запросов/сутки непригодны для обогащения каталога |
| Expedia Rapid Content | Партнёрское подключение, ключ и подпись; публичной цены нет | Самый полный состав: `area.square_meters`, **`views` как словарь кодов** («City view», «Courtyard view»), `bed_groups.configuration` (type/size/quantity), `occupancy.max_allowed`, `amenities`, `images` с подписями, `descriptions.overview`; на уровне объекта `statistics` «Number of floors» | Не проверялось; у Expedia Group операции в РФ не проверялись | Этажа комнаты нет; бесплатного тарифа не опубликовано; документация портала рендерится скриптом |
| Amadeus Hotel Search v3 | Self-service требует регистрации; тарифы не проверены (портал — SPA) | `room.type` (3 символа), `room.typeEstimated` (category/beds/bedType), `room.description` | Не проверялось | Спецификация прямо называет `typeEstimated` разобранным из описания «for informational purposes»; площади, фото, вида и этажа нет |
| Яндекс Путешествия, партнёрский API | Партнёрство, White Label, OAuth | `rooms[]`: `name`, `description`, `area.value` + `unit`, `bed_groups.configuration`, `amenities.groups`, `images.url_template` + `sizes`, `offers` с ценой в RUB, питанием, отменой, `booking_url` | Лучшее российское покрытие по заявлению поставщика | Полей вида, этажа и вместимости нет; вместимость и площадь часто только в тексте `description` |
| TravelLine Partner API | Подключение создаёт отельер либо прямой партнёр; OAuth, JWT 15 минут | Content: `roomTypes[]` с `size.value`, `occupancy` (adultBed/extraBed/childWithoutBed), `placements` с возрастами, `amenities`, `images`, `address` по категории, `fsaCertification.index`. PMS: `buildings[] → floors[] → rooms[]` с `displayName` комнаты и `floorId` | Только подключённые объекты | **Единственный задокументированный реальный этаж комнаты**; Search API разрешён только для создания бронирований; вид из окна — только в прозе `description` |
| TripAdvisor | Legacy Content API **deprecated**; Terra Discover: первые 1 000 billable entities бесплатно один раз на аккаунт, далее $0.015 → $0.009 | Данных по номерам нет: локации, отзывы, фото, фиды | Национальное по локациям | Для номеров непригоден |
| Google Places API | Платный с тарифными уровнями | Полей отельных номеров нет (в списке полей из отельного только `restroom`) | Национальное по POI | Room-level данных Google публично не отдаёт |
| Bnovo | Публичных условий нет | — | — | `docs.bnovo.ru` не отвечает: `tlsv1 unrecognized name` (та же ошибка, что 27 октября) |
| Суточно.ру, 2ГИС, Яндекс Карты, Wikidata, OSM | См. прошлые заметки | Полей по категориям номеров не дают | — | Проверено ранее, здесь не повторяется |

## Alean: вид из окна и этаж по категории номера

`robots.txt` (HTTP 200, 1 037 байт, 2026-10-28) в блоке `User-agent: *` запрещает `/dummy/`,
`/uploads/`, `/manage/`, `*/agency/*`, `/*print/`, `/cabinet/*`, `/gateways/`, `/mobile-app/`,
`/avia/`, `/*finder=*`, `/page/agency_agreement_apartments/` и объявляет
`Sitemap: https://www.alean.ru/sitemap/sitemap-index.xml`. Карточки `/hotels/...` и каталог
`/sitemap/...` разрешены. `Crawl-delay: 5` стоит только в блоке `Yandex`; для общего агента
задержка не задана, но соблюдать паузу всё равно следует.

[sitemap-hotels.xml](https://www.alean.ru/sitemap/sitemap-hotels.xml) — HTTP 200, 487 299 байт в
gzip, 30 572 `<loc>`. Карточек объектов шестого уровня внутри Сочи — 1 829, из них примеры
`.../sochi_gorod-kurort/sochi_tsentralnyy_rayon/ostrova_spa-otel/`,
`.../kudepsta/burgas_pansionat/`, `.../loo/magadan_sanatoriy/`. Городской индекс
`https://www.alean.ru/hotels/rossiya/krasnodarskiy_kray/sochi/` не существует (HTTP 404,
42 795 байт) — перечислять объекты нужно из sitemap, а не из угаданного пути города.

Измерено на карточке [«Острова» (Сочи)](https://www.alean.ru/hotels/rossiya/krasnodarskiy_kray/sochi_gorod-kurort/sochi_tsentralnyy_rayon/ostrova_spa-otel/),
HTTP 200, 456 800 байт:

| Поле | Сколько раз заполнено | Примеры значений |
|---|---|---|
| «Вид из номера» | 14 | `на море`, `на парк: на море`, `на бассейн: на парк`, `на город`, `на парк` |
| «Этаж» | 2 | `4` |
| «Площадь (кв. м)» | 16 | `44`, `32`, `33-34`, `67 + балкон терраса 35`, `62,4` |
| «Кол-во основных мест» | 16 | `2`, `4` |
| «Кол-во доп. мест» | 12 | `1`, `2` |
| «Количество комнат» | 16 | `1-комнатный`, `3-комнатный: двухэтажный`, `3-комнатный: 1-этажный` |
| «Тип номера» | 16 | `Апартаменты`, `Джуниор Сюит`, `Люкс`, `Коттедж/Вилла` |

Этаж дополнительно встречается в названиях категорий: «Джуниор Сюит 2-местный 1-комнатный
(4 этаж)», «Люкс 2-местный 2-комнатный (4 этаж)», «Стандартный 2-местный 1-комнатный (4 этаж)».
Вид тоже дублируется в названии: «Люкс 2-местный 2-комнатный (вид на море)».

Контроль на не-курортном объекте — [гостиница «Ока», Калуга](https://www.alean.ru/hotels/rossiya/kaluzhskaya_oblast/kaluga_gorodskoy_okrug/kaluga/oka_gostinitsa/)
(HTTP 200, 198 434 байта): 10 категорий, у всех десяти заполнено «Вид из номера» = `на двор`,
площади 17–55 м², основные места 1–3, поля «Этаж» на этой карточке нет. То есть поле вида
заполняется и вне курортного сегмента, а этаж — нет.

Фотографии номеров из HTML Alean взять нельзя: во всей карточке «Острова» встречается ровно один
URL изображения на `uploads2.alean.ru`, остальное подгружается скриптом. Явных атрибутов галереи
(`data-images`, `data-gallery`) в HTML нет. Правовой режим прежний: Alean — туроператор, контент
его собственный, открытой лицензии нет; извлекаем факты со ссылкой на источник, описания и фото не
перепубликовываем.

## 101hotels: номерной ряд, фото и видовые теги

`robots.txt` (HTTP 200, 7 295 байт, 2026-10-28), блок `User-agent: *`: запрещены
`/opinions/city/*/*`, `/opinions/page/*`, `/opinions/*/*/*.html/*`, `/?*`, `/opinions/city/*?*`,
`/search`, `/city*`, `/redirect`, `/favorites`, `/nearby/location`, `/widget/generator/*`,
`/booking/order_form`, `/app*`, `/mobile_app`. Пути `/main/cities/<город>` и
`/main/cities/<город>/<объект>.html` под запреты не попадают — состояние то же, что 27 октября.

[Страница города Сочи](https://101hotels.com/main/cities/sochi) — HTTP 200, 682 151 байт,
25 уникальных ссылок на карточки объектов. Непроверенная ранее
[страница `/onmap`](https://101hotels.com/main/cities/sochi/onmap) — HTTP 200, 728 392 байта,
37 уникальных ссылок на карточки, то есть она даёт больше кандидатов, чем обычная страница города,
и в `robots.txt` не запрещена. Указанный на ней источник данных карты
`https://101hotels.com/main/cities/sochi/map?in=&out=` отдаёт HTTP 404 (36 722 байта) при прямом
запросе — полного списка города через него получить не удалось; это тупик, а не механизм выгрузки.
Угаданный URL карточки `gostinichniy_kompleks_bogatir.html` вернул HTTP 404 (36 694 байта):
имена файлов нужно брать только из разрешённых листингов, не конструировать.

Измерено на карточке [«Лучезарный Резорт»](https://101hotels.com/main/cities/sochi/luchezarniy_rezort.html)
(HTTP 200, 2 105 315 байт): 57 вхождений `data-room-id`, 19 уникальных категорий. По каждой —
название с видом в скобках, «Площадь номера NNм²» (7 различных значений от 20 до 120 м²), тип
кровати, «2 спальных места», список оснащения по группам. Видовые и этажные значения лежат в группе
оснащения «Вне помещения»: `вид на море`, `вид на бассейн`, `вид на парк`, `красивый вид`, `балкон`,
`терраса`, `номер расположен на первом этаже`. Названия категорий:
«Студио (С видом на море)», «Делюкс (С видом на парк)», «Люкс (Панорамный с видом на море)»,
«Номер (Делюкс с видом на бассейн)».

Фотографии: на карточке 192 блока `ImageObject`, все изображения на `s.101hotelscdn.ru`,
внутри блоков категорий — от 10 до 46 URL на категорию (считая thumb- и полноразмерные варианты
одного кадра). У каждого блока `<meta itemprop="creditText" content="101Hotels.com">`, например
рядом с `https://s.101hotelscdn.ru/uploads/image/hotel_image/510051/4863881_thumb.jpg`. Это
источник фото номеров в нужном объёме, но заявленное правообладание — у 101hotels, поэтому
показываем с атрибуцией и ссылкой на карточку и не выдаём за свой контент.

Цену на даты карточка не отдаёт: вместо неё «Укажите дату, чтобы узнать стоимость». Дата-зависимый
прайс идёт через `/search`, закрытый в `robots.txt`, поэтому не используем.

## Островок: что лежит в уже читаемых ответах

`https://ostrovok.ru/robots.txt` — HTTP 200, 4 650 байт, 2026-10-28. В блоке `User-agent: *`
запрещены `/hotels*` (выдача поиска), `/deals*`, `/m/*`, `/orders*`, `*/otzyvy/`, `/accounts/`,
`/login*` и прочее; страницы `/hotel/<slug>/mid<id>/<ota_id>/` не запрещены, запрет `/rooms*` и
`*format=json*` стоит только в блоке `Yandex`. Объявлен `Sitemap: https://ostrovok.ru/sitemap.xml`.

`https://ostrovok.ru/api/site/multicomplete.json?query=Жемчужина Сочи&language=ru&limit=5` —
HTTP 200, 2 075 байт: `master_id`, `otahotel_id`, `slug`, `region_id`, `hotel_address`,
`hotel_kind` (`Resort`, `Guesthouse`).

[Карточка «Гостиничный Комплекс Жемчужина»](https://ostrovok.ru/hotel/russia/sochi/mid7374217/zhemchuzhina_hotel_complex/)
— HTTP 200, 395 405 байт. В `__NEXT_DATA__` ключи отеля: `amenityGroups`, `apartmentsInfo`,
`contacts`, `descriptionStruct`, `facts`, `hostInfo`, `images`, `isApartLike`, `location`,
`paymentMethods`, `policies`, `rating`, `roomGroups`, `serpFilters`, `specialFlags`,
`starCertificate`. В каждом из 15 элементов `roomGroups` ровно шесть ключей: `rgHash`,
`parentRgHash`, `nameStruct` (`mainName`, `beddingType`, `bathroom`), `size`, `roomAmenityData`,
`images`. Ни `rg_ext`, ни `view`, ни `floor`, ни `capacity` в публичном ответе нет — измерено.

Два поля, которые мы не извлекаем, но которые там есть:

- `starCertificate` = `{"certificateId": "С232024007508", "validFrom": "", "validTo": "2028-08-08"}`.
  Это номер реестровой записи федерального реестра и срок действия — тот самый идентификатор
  официальной идентичности, который прошлая заметка предлагала добывать только из 101hotels.
  Наш `backend/src/hotel_agent/adapters/external/ostrovok_page.py` читает `facts`,
  `descriptionStruct` и прочее, но `starCertificate` игнорирует.
- `apartmentsInfo` содержит ключи `bedroomsQuantity`, `floor`, `capacity`, `space`,
  `bedTypesExtranetId`, `bedCount*`. На обеих проверенных карточках все значения пустые
  (`floor: ""`, `capacity: 0`), в том числе на апарт-объекте
  [«Апарт-отель Жемчужина»](https://ostrovok.ru/hotel/russia/sochi/mid13985262/zhemchuzhina_apart_hotel/)
  (HTTP 200, 292 529 байт). Поле этажа в схеме есть, но на измеренных объектах не заполнено;
  считать его источником этажа нельзя без замера на большой выборке.

Видовые признаки у Островка бесплатно всё же есть, но слабые. На апарт-объекте в
`roomAmenityData` встретился код `with-view`, а названия категорий — «Апартаменты с видом на
город», «Апартаменты Comfort с видом на бассейн». На «Жемчужине» вид виден только в названии
(«Двухместный люкс Морской»), а в оснащении есть `balcony` и `blackout-blinds`. Полный союз кодов
оснащения по 15 категориям «Жемчужины»: `air-conditioning`, `balcony`, `bathrobe`, `bedsheets`,
`blackout-blinds`, `desk`, `hairdryer`, `heating`, `mini-bar`, `mirror`, `private-bathroom`,
`safe`, `shower`, `slippers`, `tea`, `telephone`, `toiletries`, `towels`, `tv`, `wardrobe`,
`water`. Кода направления окна или этажа среди них нет.

Ответ тарифов `GET https://ostrovok.ru/hotel/search/v1/site/hp/search` с телом по
`zhemchuzhina_hotel_complex`, 2026-12-10 → 2026-12-12, 2 взрослых, `region_id: 5580` — HTTP 200,
156 042 байта, 48 тарифов, 12 различных `rg_hash`. Ключи тарифа: `allotment`, `bed_places`,
`cancellation_info`, `contract`, `features`, `hash`, `loyalty`, `meal`, `meal_data`, `new_beds`,
`no_show`, `occupancy`, `payment_options`, `provider_id`, `room_data_trans`, `room_description`,
`room_name`, `rooms`, `serp_filters`, `shash`, `sort_scores`, `trans`. Внутри `rooms[0]`:
`allotment`, `amenities_data`, `bed_places`, `bedding_data`, `meal_data`, `multi_bed_data`,
`rg_hash`, `room_data_trans`, `room_description`, `room_name`, `serp_filters`. Подстрок `rg_ext`,
`"view"`, `floor`, `with-view`, `window`, `balcony` в ответе **ноль** — измерено подсчётом по
сериализованному JSON.

Зато там есть вместимость, которой нет в нашей модели: `occupancy: 2`,
`bed_places: {"main_count": 2, "extra_count": 0, "child_cot_count": 0, "shared_with_children_count": 0}`,
`multi_bed_data: [{"bed": "single", "count": 2}]`, `bedding_data: ["twin"]`. Наш
`ostrovok_rates.py` читает из `rooms[]` только `amenities_data` и `rg_hash`, а схема
`RoomOffer` в `docs/api/openapi.yaml` имеет поле `floor_number`, которое ничем не заполняется:
в адаптерах Островка слова `floor` нет вообще. В базе та же картина: `hotel_catalog.py`
вставляет импортированные категории с `floor_min = NULL, floor_max = NULL`, то есть этаж есть
только у синтетических seed-номеров.

## ETG / RateHawk Content API: структурированный код вида

`https://docs-api.ostrovok.ru/robots.txt` — HTTP 200, 239 байт: `User-agent: *`, `Allow: /`,
`Disallow: /tags/`, плюс sitemap. Документация открыта для чтения.

[Retrieve hotels content by IDs](https://docs-api.ostrovok.ru/docs/content-api/retrieve-hotels-content-by-ids/)
— HTTP 200, 364 072 байта. В объекте `room_groups` задокументированы `name`, `room_amenities`,
`images_ext` (с `category_slug`: `balcony`, `bathroom`, `guest_rooms`, `hotel_rooms`, `pool`, …),
`name_struct` (`main_name`, `bedding_type`, `bathroom`), `rg_ext` и `size`.

`rg_ext.view` — «Информация о виде из номера», 40 кодов: `1 — на залив`, `4 — на канал`,
`5 — на город`, `6 — на внутренний двор`, `8 — на сад`, `19 — на Кремль`, `20 — на озеро`,
`22 — на горы`, `23 — на океан`, `24 — панорамный`, `25 — на парк`, `27 — частично на море`,
`29 — на бассейн`, `30 — на реку`, `31 — на море`, `33 — на улицу`, `34 — на восход`,
`35 — на закат`, `36 — на воду`, `38 — на пляж`, `40 — на море (первая линия)` и другие. Для нас
важны `34` и `35`: наша характеристика `sunset_view` получает прямое соответствие в словаре
поставщика.

`rg_ext.floor` — «Информация об этаже номера», но значения только `0 — не определено`,
`1 — пентхаус`, `2 — двухуровневый`, `3 — цокольный`, `4 — мансардный`. Это тип этажа, не номер;
прошлая заметка была права, теперь это подтверждено полным перечнем значений.

Остальное в `rg_ext`: `class` (20 значений от run of house до шале), `quality` (25 значений от
economy до royal), `sex`, `bathroom`, `bedding` (двухъярусная, односпальная, двуспальная, twin,
несколько, кресло-кровать, диван), `family`, `capacity` (1–6 мест), `club`, `bedrooms` (1–6
спален), `balcony`.

Отдельная цитата про площадь: «Это поле доступно только через Content API для партнеров с
включенной соответствующей опцией. Чтобы ее активировать, обратитесь к аккаунт-менеджеру и
подпишите дополнительное соглашение. В дампах данных недоступно.» То есть `size` по партнёрскому
каналу требует доп. соглашения — при том, что на публичной карточке Островка `size` отдаётся
бесплатно (измерено: 17, 36, 41, 54.7, 130 м²). Это аргумент не спешить менять публичный путь на
партнёрский ради площадей.

Правовой режим фотографий остался прежним и подтверждён повторно на
[странице дампа](https://docs-api.ostrovok.ru/docs/b2b-api/static-content/retrieve-hotel-dump/)
(HTTP 200, 181 075 байт): «Весь внутренний контент — фотографии, описания и прочее — не подлежит
индексации. Это строго запрещено. Публичный контент — название, адрес, удобства и политики —
индексировать можно.»

## Nuitee LiteAPI: полный состав номера, но без вида и этажа

[GET /data/hotel](https://docs.liteapi.travel/reference/get_data-hotel) — HTTP 200, 680 357 байт.
Схема `rooms[]` (цитаты из описаний полей): `id`, `roomName`, `roomTitle`, `description`,
`markdownDescription`, `normalizedDescription`, `roomSizeSquare` («Size of the room in square
meters»), `roomSizeUnit`, `hotelId`, `maxAdults`, `maxChildren`, `maxOccupancy`,
`officialSiteRoomName` («Room name as shown on the property's own website»), `attributes`
(булевы флаги `television`, `televisionSize`, `airConditioner`, `hairDryer`, `iron`, `hangers`,
`coffeeMaker`, `crib`, `laptopFriendlyWorkplace`, `kitchen`, `smokeDetector`,
`carbonMonoxideDetector`; «null means not stated. false only when the room states it lacks the
amenity»), `ranking`, `bedTypes[]` (`quantity`, `bedType`, `bedSize`), `roomAmenities[]`,
`photos[]` (`url`, `imageDescription`, `imageClass1`, `imageClass2`, `mainPhoto`, `score`).
Полей вида из окна и этажа в схеме нет.

[API Pricing & Usage Costs](https://docs.liteapi.travel/reference/api-pricing-usage-costs) —
HTTP 200, 618 060 байт, формулировка та же, что фиксировалась 26 октября: Places и location
lookup — $0.01 за запрос, «All other Nuitee Connect endpoints are available at no additional
cost, provided usage complies with Nuitee Connect's Terms of Service», включая «Hotel content
endpoints», при «reasonable look-to-book ratio and fair usage expectations»; дашборд-места
$4.99 / $1.99 в месяц. Это бесплатность методов, а не бесплатный безлимит контента.

## Hotelbeds: единственный прозрачный бесплатный квот, но беднее по полям

`https://developer.hotelbeds.com/robots.txt` — HTTP 200, 97 байт: `User-agent: *`, пустой
`Disallow:` и закрытые `/admin`, `/meraki`, `/apitool`, `/djadmin`.

[API Reference Content API](https://developer.hotelbeds.com/documentation/hotels/content-api/api-reference/)
— HTTP 200, 9 650 байт; страница только инициализирует Redoc и указывает открытую спецификацию
`https://d2gsjv9lq0esbh.cloudfront.net/open-api-documentation/OpenAPI-Hotel-ContentAPI-3.0.yaml`
(HTTP 200, 125 906 байт). В `ApiHotelRoom`: `roomCode` (пример `DBL.ST`), `description`
(`DOUBLE STANDARD`), `characteristicCode`, `isParentRoom`, `minAdults`, `minPax`, `maxAdults`,
`maxChildren`, `maxPax`, `roomFacilities[]` (`facilityCode`, `facilityGroupCode`, `indFee`,
`indLogic`, `number`), `roomStays[]`, `roomType`, `PMSRoomCode`. Площади номера, поля вида и
этажа нет. Фотографии привязываются к номеру: в `ApiImage` есть `roomCode`, `roomType`,
`characteristicCode` и `imageTypeCode`, но «For hotel images, we do not return the full path» —
префикс добавляет клиент.

[Getting Started](https://developer.hotelbeds.com/documentation/getting-started/) — HTTP 200,
51 665 байт, прямая цитата: «Please note that the API keys provided with registration will only
give you access to our evaluation environment, with a limited allowed quota of 50 requests per
day. If the quota is exceeded you will receive a 403 error.» Это задокументированный бесплатный
тариф с конкретным пределом — и он слишком мал для обогащения каталога, но достаточен для
единичной проверки гипотезы. Регистрация в рамках этой задачи не выполнялась.

## Expedia Rapid: самая богатая схема номера из найденных

Портал Expedia документацию рендерит скриптом: `https://developers.expediagroup.com/robots.txt`
— HTTP 404 (60 байт), `.../docs/products/rapid/lodging/content/property-content` — HTTP 200, но
это «We can't find what you're looking for», `.../docs/products/rapid/get-started` — то же,
`.../rapid/lodging/content` — HTTP 200, 1 112 756 байт, в тексте только навигация. Поэтому
первоисточником взята официальная спецификация Expedia Group:
[ExpediaGroup/rapid-java-sdk/specs.yaml](https://raw.githubusercontent.com/ExpediaGroup/rapid-java-sdk/main/specs.yaml)
— HTTP 200, 1 161 203 байта, `info.title: Rapid`, `version: v3`, сервер `https://test.ean.com/v3`.

Схема `Room`: `id`, `name`, `descriptions.overview`, `amenities`, `images` («The room's images.
Contains all room images available»), `bed_groups` (каждая с `configuration[{type,size,quantity}]`),
`area` (`square_meters`, `square_feet` — «The room's area, measured in square meters»), `views`
(«A map of the room views») и `occupancy.max_allowed` (`total`, `children`, `adults`). В примере
ответа: `"area":{"square_meters":20,"square_feet":215}`,
`"views":{"4146":{"id":"4146","name":"Courtyard view"}}`,
`"occupancy":{"max_allowed":{"total":5,"children":2,"adults":4}}`. Для словаря видов есть
отдельный метод `GET /references/room-views` — «Returns a complete collection of room views
available in the Rapid API». На уровне объекта есть `statistics` с «Number of floors - 38», но
этажа конкретного номера в схеме нет.

Доступ: подпись и ключ партнёра, публичной цены и бесплатного тарифа на доступных страницах не
найдено; покрытие РФ не проверялось. Для нашей задачи это эталон модели данных, а не доступный
источник.

## Amadeus: категория номера разобрана из текста

Портал `developers.amadeus.com` — Angular SPA: и `/pricing`, и
`/self-service/apis-docs/guides/developer-guides/api-rate-limits/` отдают один и тот же документ
13 858 байт с пустым `<title>` и без содержимого. Тарифы и квоты self-service по первоисточнику
этой проверкой **не подтверждены**.

Поля номера взяты из официальной спецификации Amadeus:
[HotelSearch_v3_swagger_specification.json](https://raw.githubusercontent.com/amadeus4dev/amadeus-open-api-specification/main/spec/json/HotelSearch_v3_swagger_specification.json)
— HTTP 200, 42 223 байта. `HotelProduct_RoomDetails`: `type` («Room type code, 3 character
identifier… The second numeric character identifies the number of beds»), `typeEstimated`,
`description`. `HotelProduct_EstimatedRoomType`: `category`, `beds`, `bedType` с описанием
«estimated room category, bed type and number of beds in the room. This information has been
parsed from the room description, and is thus only provided for informational purposes».
Площади, фотографий, вида и этажа нет. Для продукта, который показывает доказательства, разобранная
из текста категория — слабое свидетельство.

## Яндекс Путешествия: номера и цены есть, вида и этажа нет

Публичные страницы по-прежнему закрыты капчей (проверено 27 октября), но документация партнёрского
API читается, причём в виде markdown: [methods.md](https://yandex.ru/dev/travel-partners-api/doc/ru/methods.md)
— HTTP 200, 5 413 байт, `content-type: text/markdown`, генератор Diplodoc. HTML-версия
[methods](https://yandex.ru/dev/travel-partners-api/doc/ru/methods) — HTTP 200, 134 568 байт, но
ссылки в ней рендерятся скриптом, поэтому для обхода документации удобнее `.md`.

Методы по отелям: `hotels/suggest`, `hotels/selection`, `hotels/search`, `hotels/hotel`,
`hotels/hotel/images`, `hotels/hotel/offers` («Возвращает информацию о номерах и ценах на них по
идентификатору отеля и основным параметрам поиска»), `hotels/hotel/reviews`, `hotels/top-offers`,
`feeds/hotels/temporary_url`.

[hotel-offers.md](https://yandex.ru/dev/travel-partners-api/doc/ru/hotel-offers.md) — HTTP 200,
15 097 байт. В `rooms[]`: `name`, `description` («Описание номера. Параметр может отсутствовать»),
`area` (`value` + `unit`, только `SQUARE_METERS`), `bed_groups.configuration` (`bed_type` —
`SINGLE` или `DOUBLE`, `name_initial_form`, `name_inflected_form`, `quantity`), `amenities.groups`,
`images` (`url_template` с `%s` под размер и список `sizes`), `offers` (`id`, `name`, `price`
value + `RUB`, `meal_type` с кодами `RO`/`BB`/`HB`/`FB`/`AI`, `cancellation.refund_type`,
`discount`, `booking_url`). Полей вида, этажа и вместимости нет; в примере ответа вместимость и
площадь лежат внутри прозы: `"description": "Особенности номера:\n- Площадь 31кв.м-33кв.м\n-Максимальная вместимость: ..."`.
Для подтверждаемых фактов это хуже, чем размеченное поле Alean.

## TravelLine: единственный документированный реальный этаж комнаты

[Документация Partner API](https://www.travelline.ru/dev-portal/docs/api/) — HTTP 200,
1 137 021 байт, Swagger развёрнут в HTML, поэтому читается без скриптов.

PMS API, точный метод:
`GET https://partner.tlintegration.com/api/pms/v2/properties/{propertyId}/obtain-accommodation-inventory`
— «Retrieves the accommodation inventory for a property». Пример ответа:

```
"accommodationInventory": { "buildings": [ { "id": "4503599628227393", "name": "Main building",
  "floors": [ { "id": "440357547227393", "name": "1st floor",
    "rooms": [ { "id": "324235253", "displayName": "111", "roomTypeId": "315367", "floorId": "4" } ] } ] } ] }
```

То есть корпус → этаж → физическая комната с её номером на двери и ссылкой на категорию. Это
ровно та структура, которая нужна продукту для утверждения «номер 111 на 1 этаже», и больше нигде
среди проверенных источников её нет. Доступ выдаёт отельер в своём кабинете либо TravelLine прямому
партнёру; это не публичный источник и не способ обогатить 34 тысячи отелей.

Content API, `roomTypes[]` (из примера ответа): `id`, `name`, `description`, `amenities[].code`,
`images[].url`, `size.value`, `categoryCode`/`categoryName`, `address` (вплоть до координат, то
есть категории могут быть по разным адресам при `multiLocationProperty`), `occupancy`
(`adultBed`, `extraBed`, `childWithoutBed`), `placements[]` (`kind`, `count`, `minAge`, `maxAge`),
`position`, `fsaCertification.index`. Последнее поле интересно отдельно: признак классификации
Росаккредитации приходит на уровне категории номера. Вид из окна — только в прозе `description`
(в примере: «Balcony with comfortable furniture, views of the Gulf of Finland and the islands»).
Справочники `room-type-categories` и `room-amenity-categories` публичны и описаны на той же
странице. Ограничение по Search API прежнее и на данные тоже распространяется: результаты поиска
разрешено использовать для создания бронирований.

## TripAdvisor и Google: по номерам ничего

[Legacy Content API](https://tripadvisor-content-api.readme.io/reference/overview) — HTTP 200,
95 555 байт, прямо сверху: «This API is deprecated. The legacy Tripadvisor Content API is no
longer being updated. Please migrate to Terra, our new and actively maintained API platform.»
Это снимает все расчёты на «5 000 бесплатных вызовов в месяц» у старого Content API.

Terra: [llms.txt](https://docs.terra.tripadvisor.com/llms.txt) — HTTP 200, 7 250 байт;
[API Access and Limits](https://docs.terra.tripadvisor.com/docs/api-access-and-limits.md) —
HTTP 200, 2 719 байт: «Discover: 10 QPS», «For customers using the Discover package, 10,000 calls
per day per API»; доступ к методам зависит от пакета (Discover, Growth, Scale, Innovate,
Transform), иначе 403.
[Usage-based pricing](https://docs.terra.tripadvisor.com/docs/usage-based-pricing.md) — HTTP 200,
4 185 байт: «Discover includes a one-time free usage allowance where the first 1,000 billable
entities for your account are free», затем от $0.01500 до $0.00900 за сущность по тиражным
ступеням; «the free allowance is granted once per account lifetime and does not repeat monthly».
[Endpoints Overview](https://docs.terra.tripadvisor.com/docs/endpoints-overview.md) — HTTP 200,
2 327 байт: предметы данных — Location Data (basic info, reviews, photos), фиды локаций, отзывов,
фото и гео. Номеров нет. Вывод: Terra — источник отзывов и фото объекта, не номеров, и его
бесплатный объём разовый.

Google: [Place Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
— HTTP 200, 245 761 байт. Среди полей из гостиничной области встречается только `restroom` и
общие `reservable`, `reviews`. Полей категорий номеров, площадей, видов и этажей нет — публичного
room-level API у Google для нас не существует.

## Фотографии номеров и права

- **Единственный источник с заведомо свободной лицензией — Wikimedia Commons** (проверено
  27 октября: каждый файл обязан быть «explicitly freely licensed», лицензия должна допускать
  перепубликацию и коммерческое использование, атрибуция может быть обязательной). Покрытие
  интерьеров номеров российских отелей там практически отсутствует; как массовый источник не
  годится.
- **Островок**: фото категорий есть в публичной карточке и используются продуктом; партнёрская
  документация прямо запрещает индексацию внутреннего контента, включая фотографии. Значит
  правильный режим — показывать по прямым ссылкам CDN с указанием источника, не копировать в
  собственное хранилище и не индексировать в векторную базу.
- **101hotels**: 192 `ImageObject` на одной карточке, каждая с `creditText: 101Hotels.com`,
  10–46 ссылок на категорию. Открытой лицензии нет; соглашение прямого запрета автоматического
  сбора не содержит (проверено 27 октября). Режим тот же: ссылка на источник и атрибуция, без
  присвоения.
- **Alean**: фотографии номеров из HTML недоступны (один URL изображения на всю карточку),
  поэтому вопрос лицензии для них практически не встаёт.
- **Партнёрские API** (Expedia `images` с подписями, LiteAPI `photos` с `imageDescription`,
  Hotelbeds `ApiImage` с `roomCode`) дают структурированные фото номеров, но условия показа
  определяются договором, а публичных display requirements по этим продуктам в этой проверке не
  читалось. Считать их «можно показывать» нельзя до чтения договора.

Общее правило для продукта остаётся: фотография номера — не доказательство вида из окна
конкретной комнаты. Подпись кадра (`imageDescription`, `caption`, `creditText`) сохраняем вместе
с URL и временем получения.

## Чего не удалось проверить

- Доля карточек Alean с заполненным «Этаж» и «Вид из номера» по России: измерено только на двух
  карточках (16 и 10 категорий). Нужен замер по фиксированной выборке из `sitemap-hotels.xml` с
  раздельным учётом заполненности каждого поля.
- Устойчивость разметки Alean и 101hotels на санаториях, хостелах и апартаментах: проверено по
  одному объекту каждого типа вёрстки.
- `apartmentsInfo.floor` у Островка: поле существует, но на двух проверенных объектах пустое;
  есть ли объекты с заполненным значением — неизвестно.
- Тарифы и квоты Amadeus self-service: портал не отдаёт содержимое без скриптов.
- Покрытие РФ у Expedia Rapid, Hotelbeds и LiteAPI: ни один вызов с ключом не делался.
- Полный список города у 101hotels: `/onmap` даёт 37 карточек вместо 25, но источник карты
  `/main/cities/<город>/map` при прямом запросе отдаёт 404, а `/search` запрещён в `robots.txt`.
- Bnovo: `docs.bnovo.ru` недоступен (`tlsv1 unrecognized name`), публичных условий чтения номеров
  и тарифов снова не найдено.
- Публичные модули бронирования на сайтах отелей (TravelLine, Bnovo) как источник номеров и цен
  на даты: не проверялись и не предлагаются — у TravelLine использование результатов поиска
  обусловлено созданием бронирований.
- Правовая оценка систематического чтения карточек Alean и 101hotels: прямого запрета в
  соглашениях нет, открытой лицензии тоже; это решение о риске.

## Что делать дальше

1. **Извлечь то, что уже приходит от Островка, без новых источников.** В
   `ostrovok_rates.py` добавить в `RoomOffer` вместимость из `occupancy`, `bed_places.main_count`,
   `extra_count`, `child_cot_count` и `multi_bed_data`; в `ostrovok_page.py` — `starCertificate`
   (`certificateId`, `validTo`) как поле официальной идентичности. Это закрывает пункт
   «вместимость» бесплатно и даёт реестровый номер без второго источника.
2. **Добавить адаптер публичной карточки Alean как источник вида и этажа категории.** Разбор
   таблиц `productTwoColsList-firstCol`/`-lastCol`: «Вид из номера», «Этаж», «Площадь (кв. м)»,
   «Кол-во основных мест», «Кол-во доп. мест», «Количество комнат», «Тип номера». URL объектов
   брать из `sitemap-hotels.xml`, сопоставлять по региону, городу, названию и координатам из
   JSON-LD. Значение «Этаж» писать в `rooms.floor_min`/`floor_max` с источником `alean` и
   пометкой «из карточки поставщика», значение вида — в факт характеристики, а не в текст.
3. **Нормализовать видовые признаки в один словарь.** Источники разные: поле Alean («на море»,
   «на парк: на море»), токен в названии Островка («с видом на море»), код `with-view`, теги
   101hotels («вид на море», «номер расположен на первом этаже»), а в партнёрском ETG — 40 кодов
   `rg_ext.view`, включая `34 — на восход` и `35 — на закат`. Словарь имеет смысл строить сразу
   по кодам ETG: тогда бесплатные текстовые значения отображаются в ту же шкалу, что и будущий
   партнёрский поток, и характеристика `sunset_view` получает прямое соответствие.
4. **Перестать показывать `RoomOffer.floor_number`, пока его нечем заполнить.** Либо убрать поле
   из `docs/api/openapi.yaml`, либо документировать, что оно заполняется только подтверждением
   отельера и Alean. Сейчас схема обещает этаж, которого ни один адаптер не даёт.
5. **Добавить 101hotels как источник фотографий и состава номеров в fallback-цепочку.** Кандидатов
   брать со страницы `/main/cities/<город>/onmap` (37 ссылок против 25 на обычной странице
   города), карточку читать по `data-room-id`, фото показывать прямыми ссылками с атрибуцией
   `101Hotels.com`. Цену «от» не выдавать за цену на даты.
6. **Замерить заполняемость, прежде чем обещать покрытие.** Фиксированная выборка городов, по
   каждому отелю — найден ли объект на Alean и 101hotels, сколько категорий, у скольких заполнены
   вид, этаж, площадь, вместимость и фото. Публиковать с числом объектов, датой и долей
   `matched`/`ambiguous`/`not_found`. Без этого замера ссылаться на 20 665 URL Alean как на
   покрытие нельзя.
7. **Партнёрские заявки — только в этом порядке и с понятной целью.** ETG Content API ради
   `rg_ext.view` и `capacity` (площадь требует отдельного соглашения, а бесплатно она и так есть
   на публичной карточке); TravelLine PMS ради единственного настоящего этажа комнаты для
   демонстрационных отелей, которые согласятся создать подключение. Expedia Rapid и Amadeus для
   задачи по России не приоритетны, Hotelbeds с 50 запросами в сутки годится только для разовой
   проверки. Terra у TripAdvisor и Google Places по номерам не дают ничего и в план не входят.
