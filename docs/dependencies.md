# Зависимости

> Сервисы, библиотеки, модель и данные Factmap с версиями и лицензиями. Версии библиотек взяты из
> `backend/uv.lock` и `frontend/package-lock.json`, версии сервисов из `docker-compose.yml` и
> Dockerfile. Код продукта распространяется под MIT. Copyleft среди зависимостей: PostGIS
> (GPL-2.0-or-later) работает отдельным сервисом базы, psycopg (LGPL-3.0) подключается как
> библиотека без изменений, данные OpenStreetMap идут под ODbL и требуют атрибуции.

**Читайте, если** вы проверяете лицензионную чистоту или собираете решение в своей среде ·
**Связано:** [архитектура](architecture.md) · [запуск](running.md)

---

## Из чего собран стенд?

| Компонент | Версия | Лицензия | Роль |
|---|---|---|---|
| Python | 3.12.15 (`python:3.12.15-slim`) | PSF-2.0 | Бэкенд |
| uv | 0.11.33 | MIT или Apache-2.0 | Установка зависимостей бэкенда по `uv.lock` |
| Node.js | 22 (`node:22-alpine`), локально 22.18 и новее | MIT | Сборка фронтенда |
| nginx | 1.27 (`nginx:1.27-alpine`) | BSD-2-Clause | Раздача фронтенда, прокси `/api/` |
| PostgreSQL | 16 | PostgreSQL | Хранилище |
| PostGIS | 3.4 (`imresamu/postgis:16-3.4`) | GPL-2.0-or-later | Геометрия, `ST_DWithin`, KNN-поиск |
| dbmate | 2.36.0 (`ghcr.io/amacneil/dbmate:2.36.0`) | MIT | SQL-миграции, одноразовый сервис Compose |

## Какие библиотеки у бэкенда?

Источник версий: `backend/uv.lock`.

| Библиотека | Версия | Лицензия | Зачем |
|---|---|---|---|
| FastAPI | 0.143.1 | MIT | HTTP API и OpenAPI |
| Starlette | 1.8.0 | BSD-3-Clause | Основа FastAPI |
| Pydantic | 2.14.1 | MIT | Схемы запросов и ответов |
| uvicorn | 0.54.0 | BSD-3-Clause | ASGI-сервер |
| psycopg (binary) | 3.3.6 | LGPL-3.0-only | Драйвер PostgreSQL, SQL без ORM |
| psycopg-pool | 3.3.3 | LGPL-3.0-only | Пул соединений |
| httpx | 0.28.1 | BSD-3-Clause | Запросы к модели, ETG и Open-Meteo |
| PyYAML | 6.0.3 | MIT | Чтение реестра характеристик |
| osmium (pyosmium) | 4.3.2 | BSD-2-Clause | Чтение экстракта OSM в `build-seed` |
| rasterio | 1.5.2 | BSD-3-Clause | Склейка и обрезка DEM, тайлы рельефа |
| Shapely | 2.2.0 | BSD-3-Clause | Геометрия фасадов и пешеходного графа |
| pyproj | 3.8.0 | MIT | Перевод координат в метрическую проекцию |
| NumPy | 2.5.4 | BSD-3-Clause с вложенными 0BSD, MIT, Zlib, CC0-1.0 | Кодирование тайлов рельефа |

Только для разработки, в образ не попадают:

| Библиотека | Версия | Лицензия | Зачем |
|---|---|---|---|
| Ruff | 0.17.0 | MIT | Линтер и форматтер |
| mypy | 2.4.0 | MIT | Проверка типов в режиме `strict` |
| import-linter | 2.15 | BSD-2-Clause | Правило зависимостей слоёв |
| pytest | 9.1.1 | MIT | Тесты |
| pytest-asyncio | 1.4.0 | Apache-2.0 | Асинхронные тесты |
| pytest-xdist | 3.8.0 | MIT | Параллельный прогон |
| jsonschema | 4.26.0 | MIT | Сверка ответов с контрактом |
| openapi-spec-validator | 0.9.0 | Apache-2.0 | Проверка `docs/api/openapi.yaml` |

## Какие библиотеки у фронтенда?

Источник версий: `frontend/package-lock.json`.

| Библиотека | Версия | Лицензия | Зачем |
|---|---|---|---|
| React, React DOM | 19.3.0 | MIT | Интерфейс |
| React Router | 7.18.4 | MIT | Маршруты |
| TanStack Query | 5.104.1 | MIT | Запросы к API, кэш |
| openapi-fetch | 0.17.0 | MIT | Типизированный клиент API |
| i18next | 26.4.3 | MIT | Тексты RU и EN |
| react-i18next | 17.0.16 | MIT | Тексты RU и EN в компонентах |
| MapLibre GL JS | 6.15.0 | BSD-3-Clause | Карта, рельеф, 3D-здания |
| PMTiles | 4.5.0 | BSD-3-Clause | Чтение локального архива подложки по HTTP Range |
| @protomaps/basemaps | 5.7.2 | BSD-3-Clause | Слои подписей улиц, районов и воды для архива Protomaps |
| SunCalc | 2.1.1 | BSD-2-Clause | Положение солнца и время заката |
| Lucide React | 1.55.0 | ISC | Иконки |
| clsx | 2.1.1 | MIT | Сборка классов |
| Manrope, JetBrains Mono (Fontsource) | 5.3.0 | OFL-1.1 | Шрифты |

Только для разработки:

| Библиотека | Версия | Лицензия | Зачем |
|---|---|---|---|
| Vite | 8.3.4 | MIT | Сборка и dev-сервер |
| TypeScript | 6.0.3 | Apache-2.0 | Типы |
| Vitest | 5.0.3 | MIT | Unit-тесты |
| Playwright | 1.64.0 | Apache-2.0 | E2E-тесты |
| @axe-core/playwright | 4.13.0 | MPL-2.0 | Проверка доступности в e2e |
| Biome | 2.5.15 | MIT или Apache-2.0 | Линтер и форматтер |
| openapi-typescript | 7.13.0, через `npx` | MIT | Генерация `schema.gen.ts` |

## Какие модели и данные используются?

| Модель или набор | Версия, источник | Лицензия | Где используется | Изменялась ли |
|---|---|---|---|---|
| DeepSeek V4.1 Flash | [Yandex Cloud AI Studio](https://yandex.cloud/ru/docs/ai-studio/), `gpt://<folder_id>/deepseek-v4.1-flash/latest` | Облачный сервис по условиям Yandex Cloud; веса не поставляются | Разбор запроса и сборка актуального запроса диалога при `LLM_PROVIDER=openai_compat` | Нет |
| OpenStreetMap | [Geofabrik](https://download.geofabrik.de/russia.html), экстракт `south-fed-district-latest.osm.pbf`; срез собран 2026-10-25 | [ODbL 1.0](https://www.openstreetmap.org/copyright) | Отели, здания, улицы, пешеходный граф, берег, пляжи, POI, источники шума | Да: вырезан прямоугольник 39,55–40,0° в. д., 43,35–43,75° с. ш. и разложен по слоям в `data/seed/sochi/` |
| Copernicus DEM GLO-30 | [Copernicus DEM на AWS](https://copernicus-dem-30m.s3.amazonaws.com/readme.html), тайлы `N43_00_E039_00` и `N43_00_E040_00` | Свободная лицензия Copernicus DEM с обязательной атрибуцией | Тайлы рельефа карты: Terrain RGB и цветной рельеф | Да: тайлы склеены и обрезаны до того же прямоугольника, `dem.tif` 1620×1440 |
| Подложка Protomaps России | Сборка `20261026`, bbox 19,6–180° в. д., 41,1–82° с. ш., z0–14, около 13 ГБ, готовит `make fetch-basemap-russia` | Данные OSM, ODbL 1.0 | Подписи вне Сочи | Да: вырезан bbox |
| Подложка Protomaps | Сборка `20261026`, tileset 4.15.2, вырезка bbox Сочи z0–15, `data/seed/sochi-map/basemap/` | Данные OSM, [ODbL 1.0](https://www.openstreetmap.org/copyright); глифы Noto Sans OFL-1.1; спрайт basemaps-assets BSD-3-Clause | Подписи улиц, районов и воды на карте | Да: вырезан bbox; полная SHA-256 в `manifest.json` |
| Open-Meteo Forecast API | `api.open-meteo.com/v1/forecast`, вызывается из `GET /api/v1/weather` | Данные [CC BY 4.0](https://open-meteo.com/en/licence); бесплатный API только для некоммерческого использования ([условия](https://open-meteo.com/en/terms)) | Погода на выбранную дату и час | Нет |
| ETG / RateHawk Hotelpage | `api-sandbox.ratehawk.com` или `api.ratehawk.com` | Партнёрский договор с ETG | Предложения на даты; на стенде ключей нет | Нет |

Строки атрибуции, которые показывает подвал README проекта:

```text
Карта: © участники OpenStreetMap, ODbL.
Рельеф: Copernicus GLO-30, © DLR e.V. 2010–2014 и © Airbus Defence and Space GmbH 2014–2018, предоставлено по программе Copernicus Европейским союзом и ESA.
```

## Как обновить таблицы?

```bash
cd backend && uv tree --depth 1
cd frontend && npm ls --depth=0
```

Лицензии библиотек фронтенда показывает `npx --yes license-checker --production --summary` из
`frontend/`, бэкенда `uv run --with pip-licenses pip-licenses --from=mixed` из `backend/`.

---

<sub>[Оглавление документации](README.md) · [README проекта](../README.md)</sub>
