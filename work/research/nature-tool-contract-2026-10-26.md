# Контракты бесплатных инструментов природы и аэропортов

Проверено 26 октября 2026 года. Только исследование: исходники приложения, конфигурация, модели и стенд не запускались и не менялись. Ниже отделены контракты поставщика от предлагаемых ограничений нашего адаптера.

## ESA WorldCover 2021 v200

**Доступ:** анонимный публичный S3, без ключа; CC BY 4.0 с атрибуцией ESA WorldCover/Copernicus. Официальная команда использует `--no-sign-request`; брать `v200/2021/map`, а не RGB WMS, непригодный для анализа. [Официальный доступ и лицензия](https://esa-worldcover.org/en/data-access).

**Точный объект для Сочи:** [ESA_WorldCover_10m_2021_v200_N42E039_Map.tif](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N42E039_Map.tif). В предыдущей проверке этой сессии анонимный HEAD получил 200 и размер 40 890 688 байт; пиксели не скачивались.

**Геометрия:** `ESA_WorldCover_10m_2021_v200_<TILE>_Map.tif`, где TILE — нижний левый угол тайла 3×3°, широта с двумя цифрами, долгота с тремя (`S48E036`: 36…39°E, −48…−45°). EPSG:4326, один байтовый класс без масштаба/смещения, шаг 1/12000°; «10 м» относится к экватору. Для точки вычислять `floor(latitude/3)*3`, `floor(longitude/3)*3`; отрицательные координаты требуют floor, не усечения к нулю. Нормализовать +180° к −180°. Данные ограничены сушей, наблюдаемой Sentinel-2; Антарктида исключена, северная граница 82.75°N. [PUM v2, разделы 3.1–3.4](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf).

**Классы Map:** `0=no data`, `10=tree cover`, `20=shrubland`, `30=grassland`, `40=cropland`, `50=built up`, `60=bare/sparse vegetation`, `70=snow/ice`, `80=permanent water bodies`, `90=herbaceous wetland`, `95=mangroves`, `100=moss/lichen`. Значение 0 подтверждено также [официальным ESA APEx справочником категорий](https://ge-config-builder.apex.esa.int/guide/workshops/05-categorical-data/03-categories-cog.html).

**Предлагаемый транспорт:** HTTP Range через COG-совместимый читатель; фиксированная версия, кэш по URL и окну/блоку. Ограничить радиус и число пикселей; на границе читать соседние тайлы в пределах бюджета. 404, HTTP-сбой, 0, неизвестный код и координаты вне покрытия дают `unknown`, а не отсутствие леса. Для долей исключать неизвестные пиксели из знаменателя и возвращать отдельно долю покрытия. Не интерполировать категории. Для полного разрешения выбирать исходный уровень, а не обзор с иным масштабом.

**Допустимый вывод:** класс/доля поверхности в заданном радиусе за 2021 год. Это не актуальная доступность парка, не вид из номера, не породы деревьев и не доказательство тишины. Шаг в градусах делает площадь пикселей зависимой от широты: для больших окон нужны веса площади или перепроекция.

## GBIF: таксон и находки

**Сопоставление:** публичный `GET https://api.gbif.org/v1/species/match?name=<URL-encoded scientific name>`. `scientificName` поддерживается как скрытый алиас; предпочтителен документированный `name`. `strict=true` запрещает откат к высшим таксонам, но сохраняет нечёткое сопоставление. Проверять ответ, а не считать strict гарантией EXACT. Не использовать скрытый `/match2` как стабильный контракт. [Первичный код GBIF NubResource](https://raw.githubusercontent.com/gbif/checklistbank/master/checklistbank-nub-ws/src/main/java/org/gbif/checklistbank/ws/nub/NubResource.java).

**Ответ:** `usageKey`, необязательный `acceptedUsageKey` для синонима, `scientificName`, `canonicalName`, `rank`, `status`, `confidence` (0…100), `matchType`. Типы совпадения: EXACT, FUZZY, HIGHERRANK, AGGREGATE, NONE. Статус может быть ACCEPTED, SYNONYM, DOUBTFUL. Успех синонима: использовать `acceptedUsageKey`; иначе `usageKey`. При NONE/пустом ключе останавливаться; неподходящий ранг, FUZZY и DOUBTFUL показывать как неопределённость. [Модель NameUsageMatch](https://gbif.github.io/gbif-api/apidocs/org/gbif/api/model/checklistbank/NameUsageMatch.html), [enum MatchType](https://gbif.github.io/gbif-api/xref/org/gbif/api/model/checklistbank/NameUsageMatch.html).

**Один фактический JSON-пробник:** анонимный GET `/v1/species/match?name=Conyza%20canadensis` вернул `usageKey=5404801`, `acceptedUsageKey=3146791`, `status=SYNONYM`, `rank=SPECIES`, `confidence=98`, `matchType=EXACT`. Не рассчитывать на наличие JSON-поля `synonym`: в этом ответе его нет.

**Поиск находок:** `GET /v1/occurrence/search` с `taxonKey`, `country=RU`, `hasCoordinate=true`, `hasGeospatialIssue=false`, ограниченным пространством и `limit`. Для прямоугольника использовать `decimalLatitude=min,max` и `decimalLongitude=min,max`, затем локально проверять геодезический радиус; пересечение антимеридиана разбивать. Фильтры `year`, `basisOfRecord`, `occurrenceStatus`, `license`, `coordinateUncertaintyInMeters` документированы в [параметрах GBIF](https://gbif.github.io/gbif-api/apidocs/org/gbif/api/model/occurrence/search/OccurrenceSearchParameter.html). Открытые числовые диапазоны/нулевую неопределённость не изобретать; при необходимости проверять запись локально.

Сохранять из `results`: `key`, `datasetKey`, `publishingOrgKey`, `scientificName`, `taxonKey`, `acceptedTaxonKey`, `decimalLatitude`, `decimalLongitude`, `coordinateUncertaintyInMeters`, `coordinatePrecision`, `eventDate`, `year/month/day`, `basisOfRecord`, `occurrenceStatus`, `license`, `rightsHolder`, `issues`. Координаты интерпретированного ответа WGS84; неопределённость — радиус в метрах. [Модель Occurrence](https://gbif.github.io/gbif-api/apidocs/org/gbif/api/model/occurrence/Occurrence.html), [описания дат и полей](https://techdocs.gbif.org/en/data-use/download-formats).

Неопределённость null означает неизвестность, 0 не является корректным значением неопределённости. Географически обобщённые точки могут защищать чувствительные виды. [Правила качества GBIF](https://techdocs.gbif.org/en/data-publishing/data-quality-recommendations). Дата находки отличается от загрузки; неполная дата может обозначать интервал. Для недавних наблюдений отбирать подходящий `basisOfRecord` и PRESENT; музейный образец/историческая находка не подтверждают наличие сейчас.

**Лицензии:** запросить `license=CC0_1_0&license=CC_BY_4_0` и проверить URI лицензии в каждом ответе. Исключить CC_BY_NC_4_0/неизвестную для коммерчески пригодного продукта; сохранять происхождение и атрибуцию. Изображения имеют отдельные права. [Enum License](https://gbif.github.io/gbif-api/apidocs/org/gbif/api/vocabulary/License.html), [мультимедиа GBIF](https://techdocs.gbif.org/en/data-publishing/multimedia-publishing).

**Предлагаемые пределы:** один match на имя с кэшем 30 дней; один search до 100 записей на пространственное окно/таксон/период, кэш сутки, явный `truncated` если найдены дополнительные результаты. Это наши проектные значения, не гарантии поставщика. GBIF рекомендует идентифицирующий User-Agent; нагрузочная квота меняется, при 429 уменьшать частоту. Отсутствие результатов означает отсутствие записей в запросе, не отсутствие вида. [Правила API](https://techdocs.gbif.org/en/openapi/). Массовые асинхронные выгрузки требуют бесплатной регистрации и Basic Auth; в текущую работу не входят. [Download API](https://techdocs.gbif.org/en/data-use/api-downloads).

## OurAirports

**Анонимный официальный CSV:** [airports.csv](https://davidmegginson.github.io/ourairports-data/airports.csv). Дамп обновляется каждую ночь, Public Domain, без гарантии точности; не требует оплаты, ключа или регистрации. [Официальная страница загрузки](https://ourairports.com/data/).

**Проверка 26.10:** ограниченный HTTP Range `bytes=0-16383`, жёсткий максимум ответа 65 536 байт; фактически получено 16 384 байта. Заголовок: `id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords`. Читать стандартным CSV-парсером, не разбивать строки по запятой.

**Важное расхождение:** [нынешний официальный словарь](https://ourairports.com/help/data-dictionary.html) перечисляет `closed_airport`, но в реально полученном фрагменте есть `type="closed"`. Поэтому для поиска аэропортов использовать whitelist `large_airport,medium_airport,small_airport`; оба значения закрытия исключать. Heliport/seaplane_base/balloonport — другие транспортные категории.

`latitude_deg/longitude_deg` — десятичные градусы с положительными севером/востоком; `elevation_ft` — футы. `scheduled_service=yes` означает наличие регулярного авиасообщения в базе; не гарантирует текущую работу аэропорта, рейсы или продажу билетов. `municipality` обозначает обслуживаемый город, не обязательно физическое расположение. `ident` — внешний ключ, `id` — устойчивый внутренний. `iso_country=RU` пригоден как фильтр страны базы. [Словарь](https://ourairports.com/help/data-dictionary.html).

**Предлагаемый транспорт:** скачать один ограниченный по размеру CSV снимок, кэшировать сутки и искать расстояния локально; не скачивать весь файл для каждого отеля. Проверять координаты/тип, хранить дату снимка. Выводить расстояние по прямой, не время поездки/трансфер/авиашум. Ближайшая запись не обязательно аэропорт, из которого пользователь может улететь в нужную дату.
