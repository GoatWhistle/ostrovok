# Project context

Project: О!дин шаг до идеального отеля — агент собирает уникальные характеристики отелей из
открытых данных и у отельера, хранит их фактами с провенансом и ищет отели запросом на
естественном языке.
Hackathon and track: {{HACKATHON}}, {{TRACK}} — организаторские материалы ещё не заведены в `brief/`.
Deadline: {{date, time, timezone}}
P0 scenario: пользователь вводит «тихий номер с видом на закат недалеко от моря» и получает список
отелей с объяснением каждого совпадения, геообъектами для подсветки и параметрами камеры.

Фронтенд влит из `feat/hotel-frontend` в `feat/hotel-agent-mvp`; дальше обе части идут одной веткой.
Источник истины по API — [`docs/api/openapi.yaml`](../docs/api/openapi.yaml): форма ответов не
меняется без правки этого файла.

## Current facts

| Topic | Status | Evidence |
|---|---|---|
| Стенд Compose :8080 | verified | [Проверки чата, карточек и карты](../docs/evidence.md), 2026-10-26 |
| API и слои | implemented | [OpenAPI](../docs/api/openapi.yaml), [архитектура](../docs/architecture.md), ADR 0001/0002 |
| LLM и факты | verified | DeepSeek V4.1 Flash через Yandex; Qwen3 Embedding 8B через Polza индексирует 34 087 отелей. Факты из БД, веб-источников и инструментов погоды/солнца/вида. [Решения](../docs/design-decisions.md) |
| Россия и рельеф | verified | OSM в PostGIS, DEM по запросу; [доказательства и размеры](../docs/evidence.md), [полные прежние факты](../work/session-state-2026-10-26-regions.md) |
| География поиска | verified | Город из адресов OSM или регион по полигону; Дагестан проверен в новом и старом чате. [Результаты](../docs/evidence.md#поиск-горных-отелей-по-региону) |
| Произвольные пожелания | verified | Исследование записей и DEM; [отрицательные результаты 50 запросов и границы проверки](../docs/limitations.md) |
| Бесплатные сведения | implemented | `HOTEL_DATA_MODE=free` отключает коммерческие API; локальный OSM и публичные страницы с JSON-LD. [Границы](../docs/hotel-data.md); режим включён на стенде [26 октября](../work/yandex-restart-2026-10-26.md) |
| Номера и поставщик | verified | JSON сайта Островка без ключа: живые тарифы для 4 из 5 проверенных отелей; ограниченная выборка, не оценка охвата. [Доказательства](../docs/evidence.md#предложения-сайта-островка-без-ключа-26-октября-2026) |
| Карта и текстуры | verified | [Проверки объединённого интерфейса](../work/building-texture/finish-review.md) |

## Pointers

- [Session](SESSION.md)
- [Open questions](open-questions.md)
- [Organizer materials](../brief/README.md)
- [Working artifacts](../work/README.md)
- [Product documentation](../docs/README.md)

- Implemented: [free event/nature/weather tools](../docs/free-tools.md), wired into the agent; local tests and limited free probes passed. Updated stand and live KudaGo are not verified.

- Implemented: [chat consultation/search routing](../docs/chat-dialogue.md), source changes and offline/DB/frontend checks passed; live model routing not verified.
