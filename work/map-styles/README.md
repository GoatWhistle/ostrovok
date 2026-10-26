# Пять карт Сочи

```bash
make -C work/map-styles serve
```

Открыть [галерею](http://localhost:8090). Python 3, без сборки и без API-ключей. Сервер поддерживает HTTP Range для PMTiles. Все библиотеки, модели, шрифты и данные лежат рядом; интернет при просмотре не нужен. `file://` не поддерживается.

| Пример | Отрисовка |
|---|---|
| [Чистый вектор](01-clean.html) | MapLibre / Protomaps, классы зданий, векторное море |
| [Игрушечный городок](02-toy.html) | three.js, инстансы Kenney, волны, тени по солнцу в worker |
| [Изометрическая стратегия](03-iso.html) | deck.gl: SolidPolygonLayer, ScenegraphLayer, экспериментальные GPU-тени |
| [Закатный пейзаж](04-sunset.html) | Copernicus DEM, ступени высот, горизонтали в worker, тёплое небо |
| [Ночной неон](05-neon.html) | Светящиеся окна шейдером, линии дорог, пульсация маршрута |

Во всех примерах доступны Адлер вокруг Cosmos и центр Сочи вокруг Жемчужины. Камеры, час по Москве на 26.10.2026, подписи, маршруты, предметы и эффекты переключаются в панели. Reduced motion отключает волны и пульсации. При медленных кадрах последовательно убираются предметы, эффекты и снижается DPR до 1,5. HUD считает интервалы requestAnimationFrame; при статичной карте это частота браузера, не скорость полного перерисовывания карты.

Данные настоящие. Путь Cosmos к морю взят из рассчитанного графа. Для выбранных баров пеший путь не найден в заданном локальном графе: пунктир показывает расстояние по прямой, без выдуманных минут. Центр Сочи не имеет сохранённого пути к морю в этом срезе.

Тип зданий может быть выведен по связи с отелем, POI или landuse; source хранится в JSON. Высоты без height/levels — условные 6,4 м, source=estimate. Декоративная растительность, зонтики, лежаки и свет в окнах не являются фактами OSM. Подготовлено 15 Kenney моделей, 16–386 треугольников; текстуры палитры запечены в цвета вершин, поэтому текстурный атлас и запросы изображений не нужны. Зонтик и лежак — простые процедурные модели. Тени worker используют выпуклую оболочку проекции контура: для вогнутых зданий это приближение, не расчёт инсоляции номера.

## Воспроизведение данных

Основной стенд и миграции должны быть подняты, основные данные Сочи загружены. Скачивание выполняется отдельно от импорта:

```bash
make fetch-map-layers
PMTILES_BIN=/path/to/pmtiles make fetch-basemap
make import-map-layers
DATABASE_URL=postgresql://hotel:hotel@localhost:5432/hotel \
  backend/.venv/bin/python work/map-styles/build-data.py
backend/.venv/bin/python work/map-styles/build-terrain.py
```

Замените параметры подключения на свои. Для существующего подготовленного среза `make import-map-layers` работает без сети. PMTiles для каждой сцены вырезается из локального архива командой `pmtiles extract data/raw/sochi-basemap.pmtiles work/map-styles/shared/data/adler.pmtiles --bbox=<bbox из manifest.json> --maxzoom=15`; аналогично sochi. DEM имеет 89 локальных тайлов z13 с запасом по краям для горизонталей.

Для повторной подготовки моделей: `python3 work/map-styles/fetch-models.py`, затем `python3 work/map-styles/prepare-models.py` и `backend/.venv/bin/python work/map-styles/bake-model-colors.py` из корня репозитория. `MAP_MODEL_ARCHIVES` меняет каталог архивов. Скрипт `fetch-assets.py` обновляет отсутствующие браузерные библиотеки и глифы; установленные в frontend MapLibre 6.15.0, SunCalc 2.1.1 и Manrope 5.3.0 также скопированы в этот снимок. Точные версии и источники — [исследование](research.md) и файлы LICENSE рядом с ресурсами.

## Атрибуция

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL: геометрия, теги, производные слои и подложка. Overpass timestamp 2026-10-26T13:33:39Z; Protomaps сборка 20261026, tileset 4.15.2. Скачан только bbox Сочи, архив планеты не загружался. Copernicus GLO-30: [условия использования](https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model).

[Kenney](https://kenney.nl/assets): Nature, Holiday, Watercraft, City Kit Suburban, CC0. MapLibre/PMTiles/Protomaps/contour — BSD-3-Clause; three.js/deck.gl/SunCalc — MIT; Manrope/Noto Sans — SIL OFL. Полные тексты лежат в shared/vendor, shared/fonts и shared/models. Сторонние файлы сохранены с исходными заголовками и именами модулей.

[Результаты и ограничения](scorecard.md), [протокол измерений](benchmark-plan.md), [скриншоты](evidence/). Перенос в приложение ждёт выбора пользователя; новых зависимостей приложения в этой части нет.

Браузерная проверка: `node work/map-styles/capture.cjs`; замер кадров: `node work/map-styles/benchmark.cjs`. Нужны установленный Playwright из frontend и Chromium; `CHROMIUM_PATH` задаёт исполняемый файл, `PLAYWRIGHT_MODULE` — нестандартный путь модуля. Скрипты работают последовательно, без конкуренции страниц за GPU. `benchmark-http.py` ожидает стенд на 18082; `benchmark-tiles.py` использует DATABASE_URL. Замеры записываются в evidence.
