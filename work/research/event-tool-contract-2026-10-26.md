# Контракт инструмента событий: KudaGo и Event

Проверено 26.10.2026 по первичным документам. Live API повторно не вызывался: ранее анонимный запрос KudaGo вернул 403. Это контракт документации, а не подтверждение доступности со стенда. Примеры ниже сокращены; названия, URL и идентификаторы синтетические, временные значения сохранены лишь для иллюстрации формата.

## KudaGo

[Документация и лицензия](https://docs.kudago.com/api/) подтверждают бесплатность, включая коммерческое использование с ограничениями. Нужна прямая индексируемая ссылка на конкретный материал, без `nofollow`/`noindex`; продажа/выгода от передачи материалов запрещена. Доступность не гарантируется. Ключ в документированных запросах не требуется.

`GET https://kudago.com/public-api/v1.4/search/?q=театр&ctype=event&location=msk&page_size=10&expand=place,dates`

Поиск: `ctype=event`; старый пример использует противоречивое `events`. Ответ содержит `daterange`, не список сеансов:

```json
{"count":1,"next":null,"previous":null,"results":[{"id":101,"title":"Пример","ctype":"event","place":{"id":201},"daterange":{"start":1489312800,"end":1489312800}}]}
```

`GET https://kudago.com/public-api/v1.4/events/101/?fields=id,title,dates,place,location,categories,site_url,is_free,price&expand=place,location,dates`

Сокращённая форма детализации с расширением:

```json
{
  "id":101,"title":"Пример",
  "dates":[{"start":1489312800,"end":1489312800,"start_date":"2017-03-12","start_time":"13:00:00","end_date":null,"end_time":null,"is_continuous":false,"is_endless":false,"is_startless":false,"schedules":[],"use_place_schedule":false}],
  "place":{"id":201,"title":"Площадка","address":"Адрес","coords":{"lat":55.73,"lon":37.64},"is_closed":false,"location":"msk"},
  "location":{"slug":"msk","timezone":"GMT+03:00","coords":{"lat":55.75,"lon":37.62}},
  "categories":["theater"],"site_url":"https://kudago.com/msk/event/example/","is_free":false,"price":"от 1000 рублей"
}
```

Без расширения: `dates=[{"start":...,"end":...}]`, `place={"id":...}`, `location={"slug":...}`. `site_url` — KudaGo, не организатор. Категории — строковые слаги. `actual_since`/`actual_until` документированы как начавшиеся после/закончившиеся до границы, UNIX/ISO, UTC. Радиус — метры. `page_size≤100`; обычный список по умолчанию содержит только `id,title,slug`. Поля отмены не документированы. [Источник контракта](https://docs.kudago.com/api/).

## Schema.org Event

Синтетический JSON-LD, соответствующий типам официальной [схемы Event](https://schema.org/Event):

```json
{
  "@context":"https://schema.org","@type":"MusicEvent","name":"Пример",
  "startDate":"2026-11-02T19:00:00+03:00","endDate":"2026-11-02T21:00:00+03:00",
  "eventStatus":"https://schema.org/EventRescheduled",
  "previousStartDate":"2026-11-01T19:00:00+03:00",
  "eventAttendanceMode":"https://schema.org/MixedEventAttendanceMode",
  "location":[{"@type":"Place","name":"Площадка","address":{"@type":"PostalAddress","streetAddress":"Адрес","addressLocality":"Москва"},"geo":{"@type":"GeoCoordinates","latitude":55.73,"longitude":37.64}},{"@type":"VirtualLocation","url":"https://example.org/stream"}],
  "url":"https://example.org/event"
}
```

`startDate`/`endDate` допускают Date или DateTime; location также бывает текстом, PostalAddress, Place, VirtualLocation. `eventSchedule` задаёт повторение: наличие расписания не предполагает `startDate`/`endDate` на самом Event. `previousStartDate` может повторяться. Перечень статусов: Scheduled, Cancelled, Postponed, Rescheduled, MovedOnline с префиксом `Event`. [Типы Event](https://schema.org/Event), [перечисление статусов](https://schema.org/EventStatusType). Наличие разметки не предоставляет права переиспользовать содержание сайта.

## Рекомендации реализации — инженерный вывод

- Для афиши по датам использовать `/events/`, а текстовый `/search/` — для получения кандидатов. В первом запросе достаточно одной страницы на 10–20 результатов, `text_format=plain` и ограниченного `fields`; расширять только `place,location,dates`. После текстового поиска выгоднее один `/events/?ids=101,102,...` с нужными полями, чем множество detail-запросов. Не добавлять недокументированный `q` в `/events/`.
- Для списка задавать `location`, `actual_since`, `actual_until`, при необходимости `categories` или `lat,lon,radius`. Локально проверять пересечение каждого интервала с поездкой. Документированная семантика фильтров не доказывает охват длительных выставок, начавшихся до поездки: полноту не обещать. Проверку фактической overlap-семантики отложить до доступного API, без обхода 403.
- `daterange` — диапазон кандидата, не доказательство конкретного сеанса. Равные `start/end` — допустимый пример документации; не удалять как ошибку и не изобретать длительность. Нули, отсутствующие границы, `is_startless/is_endless`, расписания и `use_place_schedule` сохранять как неопределённость.
- Расстояние считать до `place.coords`, никогда до `location.coords` (центр города). `place={id}` и отсутствие координат не подтверждают близость к отелю. Прямая дистанция не равна пешему маршруту. Закрытая площадка и отменённое событие — разные факты.
- KudaGo без явного статуса отмены: `status=unknown`, а не Scheduled. В JSON-LD исключать Cancelled, отдельно предупреждать о Postponed; для Rescheduled использовать новую дату и сохранять старую; чисто виртуальные события не использовать для выбора расположения отеля.
- Разбирать отдельный объект, массив, `@graph`, массив `@type`, подклассы Event; не исполнять содержимое. Date без времени оставлять датой, DateTime без смещения — временем с неизвестной зоной до получения достоверной зоны. Отсутствие даты, цены или статуса не заполнять догадкой.
- Ограничить число страниц/байты/таймаут; `next` считать недоверенным URL и при необходимости конструировать следующую страницу самим на фиксированном HTTPS-хосте. 403/429/ошибку источника показывать честно, без платного fallback. Хранить источник, fetched_at, ссылку, исходные статусы/даты. Это предложенные локальные ограничения, не заявленный тариф или rate limit KudaGo.

Для парсера сайта дополнительно действуют права конкретного издателя и robots; Schema.org описывает формат, не разрешение обхода ограничений.
