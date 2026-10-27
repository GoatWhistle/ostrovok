# Запуск и проверки

> Стенд поднимают две команды: `make up` собирает образы и запускает PostGIS, миграции, бэкенд и
> фронтенд, а `make seed && make precompute` загружает срез Сочи и рассчитывает факты. Ключи не
> нужны: без `.env` работает офлайн-разбор запросов. Сеть нужна для сборки образов и прогноза погоды.

**Читайте, если** вы запускаете стенд или прогоняете проверки · **Связано:**
[архитектура](architecture.md) · [зависимости](dependencies.md)

---

## Как запустить через Docker?

Нужны Docker с Compose v2 и buildx, GNU Make и [uv](https://docs.astral.sh/uv/) на хосте:
`make seed` и `make precompute` запускаются не в контейнере. Из корня репозитория:

```bash
make up
make seed && make precompute
```

| Адрес | Что это |
|---|---|
| http://localhost:8080 | Интерфейс |
| http://localhost:8000/api/v1/health | Проверка здоровья API, в ответе имя провайдера модели |
| http://localhost:8000/docs | Swagger |
| `localhost:5432` | PostgreSQL с PostGIS, пользователь, пароль и база `hotel` |

Все порты слушают только `127.0.0.1`.

Подложку с подписями Compose монтирует из `data/seed/sochi-map/basemap/` во фронтенд, nginx отдаёт её
по `/maps/sochi/` частями (`Range`); сеть для неё не нужна.

Подложка всей России (z0–14, около 13 ГБ) в Git не хранится. Её готовит
`PMTILES_BIN=/path/to/pmtiles make fetch-basemap-russia`: вырезка из сборки Protomaps, проверка,
манифест с SHA-256 и ссылка на архив с хешем в имени в каталоге `MAP_BASEMAPS_HOST_DIR`
(по умолчанию `data/basemaps`). Compose монтирует этот каталог во фронтенд и бэкенд только для
чтения, после этого `/api/v1/map/style?region_id=russia` отвечает `available: true`. Без каталога
стенд работает с подложкой Сочи.

| Команда | Что делает | Сеть |
|---|---|---|
| `make up` | `docker buildx bake`, затем `docker compose up -d --wait`; миграции dbmate применяются до старта бэкенда | Для сборки образов |
| `make seed` | Загружает срез `data/seed/sochi` в PostGIS; повторный запуск обновляет те же записи без дублей | Нет |
| `make precompute` | Считает по загруженному срезу факты: высоту здания, уровень шума, пеший маршрут до моря, фасады; затем ставит вопросы отельерам | Нет |
| `make plan-questions` | Ставит вопросы отельерам по характеристикам реестра, для которых у отеля нет факта; повторный запуск новых вопросов не добавляет. На уже запущенном стенде: `docker compose exec backend python -m hotel_agent.cli plan-questions --region sochi` | Нет |
| `make plan-questions` | Ставит вопросы отельеру по характеристикам реестра без фактов | Нет |
| `make down` | Останавливает стенд, том с базой `db-data` остаётся | Нет |
| `make logs` | Логи всех сервисов | Нет |
| `make build` | Только сборка образов через `docker-bake.hcl` | Да |
| `make help` | Список целей | Нет |

Для ручной загрузки 15 проверенных соответствий OSM и Nuitee нужен тестовый или рабочий
ключ `NUITEE_API_KEY` в игнорируемом `.env`. Команда обращается к API поставщика и записывает
категории номеров и услуги в PostgreSQL:

```bash
bash scripts/sync-nuitee-matches.sh
```

Пары хранятся в `data/seed/sochi/nuitee_matches.csv`. Импорт повторяемый; он использует
реальный каталог Nuitee и не входит в офлайн-команду `make seed`. Без ключа завершается ошибкой.

Образы собирает только `docker-bake.hcl`. Compose берёт готовые образы
`<COMPOSE_PROJECT_NAME>-backend:<TAG>` и `<COMPOSE_PROJECT_NAME>-frontend:<TAG>` и не скачивает их
из реестра (`pull_policy: never`), поэтому `docker compose up` без сборки остановится с ошибкой об
отсутствующем образе. Переменные сборки `TAG`, `SITE_URL` и `COMPOSE_PROJECT_NAME` bake берёт из
окружения, а не из `.env`.

Реестр характеристик `characteristics/` и данные `data/` в образ не попадают: Compose монтирует их
только для чтения в `/srv/characteristics` и `/srv/data`. Образ бэкенда без этих каталогов рядом не
запускается.

## Как построить семантический индекс?

Ключ `EMBEDDING_API_KEY`, модель `qwen/qwen3-embedding-8b` и адрес
`EMBEDDING_BASE_URL=https://polza.ai/api/v1` задаются в `.env`. Команда обращается к платному
API только при явном ручном запуске. Перед ней нужны применённые миграции и загруженная БД.
Из каталога `backend/`:

```bash
uv run python scripts/index_search.py --env-file ../.env --batch-size 64 --concurrency 8
```

Документы читаются из PostgreSQL, индекс и завершённые батчи сохраняются в
`data/raw/semantic/`. Повторный запуск использует сохранённые векторы для неизменённых
текстов. `progress.json` содержит число обработанных фрагментов и статус; состояние
`complete` означает завершение снимка каталога. После импорта новых данных команду нужно
запустить ещё раз, затем пересоздать backend, чтобы загрузился новый индекс:

```bash
docker buildx bake backend
docker compose up -d --force-recreate backend
```

Без индекса или ключа API использует лексическое извлечение и не запускает платную
векторизацию. Ключи и индекс не входят в Git; каталог `data/` примонтирован в backend.

## Как обновить демо-данные?

Готовый срез Сочи лежит в репозитории, эти команды нужны только при смене границ или обновлении
данных.

| Команда | Что делает | Сеть |
|---|---|---|
| `make fetch-seed` | Скачивает экстракт OSM «Южный ФО» с Geofabrik и два тайла Copernicus GLO-30 в `data/raw/` | Да |
| `make fetch-russia` | Докачивает полный OSM-снимок России в `data/raw/` и проверяет MD5; это не импорт в PostGIS | Да |
| `make ingest-russia` | Потоком загружает отели и объекты интереса из проверенного PBF в регион `russia`; сохраняет пакеты по 5000 записей и останавливается, если свободно меньше 6 ГиБ | Нет |
| `make build-seed` | Режет из `data/raw/` срез Сочи в `data/seed/sochi/` и печатает число объектов каждого слоя | Нет |

`make ingest-russia` повторяем: существующие OSM ID обновляются. Слой выбирается через
`RUSSIA_LAYERS`, например `RUSSIA_LAYERS='coastline noise_sources walk'`.
Большие слои загружают отдельным запуском после проверки свободного места. Для зданий
используйте `RUSSIA_LAYERS=buildings RUSSIA_BUILDING_RADIUS_M=350 make ingest-russia`:
двухпроходный режим сохраняет замкнутые контуры в 350 м от ранее загруженных отелей,
не создавая индекс всех узлов России. После импорта отели связываются с найденными
зданиями. Пляжи и мультиполигоны OSM-отношений в этот проход не входят. Импорт OSM не
добавляет номера, цены или цифровую модель рельефа. В остальных городах карту высот
бэкенд получает из внешнего сервиса Mapterhorn.

## Как включить живую модель и предложения на даты?

Скопируйте `.env.example` в `.env`, заполните `LLM_*` или `ETG_*` из
[таблицы переменных](#какие-переменные-читаются) и снова выполните `make up`. `.env` лежит в
`.gitignore`. `make llm-check` делает один настоящий вызов к провайдеру из `.env` и тратит
квоту; ни тесты, ни `make seed` его не вызывают.

## Как разрабатывать без Docker?

База должна работать: `make up` или `docker compose up -d db migrate`. Бэкенд с перезагрузкой на
порту 8000 против базы из Compose:

```bash
make api
```

Фронтенд, нужен Node.js 22.18 или новее:

```bash
cd frontend
npm ci --silent
npm run dev
```

Адрес покажет Vite. Dev-сервер проксирует `/api` на `API_URL`, по умолчанию
`http://localhost:8000`.

## Какие переменные читаются?

Все необязательны: без них стенд работает с офлайн-разбором и без предложений поставщика.

| Переменная | По умолчанию | Что задаёт |
|---|---|---|
| `LLM_PROVIDER` | `fake` | `fake`: офлайн-разбор по фразам реестра, без ключа и сети; `openai_compat`: живой OpenAI-совместимый endpoint; `anthropic` останавливает запуск с ошибкой, адаптера нет |
| `LLM_BASE_URL` | пусто | Адрес endpoint, например `https://llm.api.cloud.yandex.net/v1`. Обязателен для `openai_compat` |
| `LLM_API_KEY` | пусто | Ключ провайдера. Обязателен для `openai_compat` |
| `NUITEE_API_KEY` | пусто | Ключ Nuitee Connect для категорий номеров и проверки тарифов; тестовый ключ помечает ответ как sandbox |
| `LLM_MODEL` | пусто | Имя модели, например `gpt://<folder_id>/deepseek-v4.1-flash/latest`. Обязателен для `openai_compat` |
| `LLM_FALLBACK_MODEL` | пусто | Резервная модель того же endpoint; вызывается после таймаута или ошибки 5xx основной модели |
| `LLM_TIMEOUT_S` | `30` | Таймаут запроса к модели, секунды, больше нуля |
| `ETG_KEY_ID`, `ETG_API_KEY` | пусто | Партнёрские реквизиты ETG/RateHawk, задаются вместе. Без них предложения отвечают `provider_unavailable` |
| `ETG_ENVIRONMENT` | `sandbox` | `sandbox` или `production` |
| `CHARACTERISTICS_DIR` | `characteristics` | Каталог реестра характеристик; в Compose `/srv/characteristics` |
| `SEED_DIR` | `data/seed` | Каталог среза; из него бэкенд читает `sochi/dem.tif` для рельефа; в Compose `/srv/data/seed` |
| `DATABASE_URL` | `postgresql://hotel:hotel@localhost:5432/hotel` | Адрес базы для бэкенда вне Compose; в Compose собирается из `POSTGRES_*` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `hotel` | Учётные данные базы; их же читают `make seed` и `make precompute` |
| `POSTGRES_PORT` | `5432` | Порт базы на хосте |
| `BACKEND_PORT` | `8000` | Порт бэкенда на хосте |
| `FRONTEND_PORT` | `8080` | Порт интерфейса на хосте |
| `API_UPSTREAM` | `http://backend:8000` | Куда nginx фронтенда проксирует `/api/` |
| `API_URL` | `http://localhost:8000` | Куда проксирует `/api` dev-сервер Vite |
| `MAP_ASSET_URL` | значение `API_URL` | Куда dev-сервер Vite проксирует `/maps`: подложки PMTiles, шрифты и спрайты. Для стенда Compose это адрес фронтенда, например `http://localhost:8080` |
| `API_SCHEMA_URL` | `docs/api/openapi.yaml` | Источник схемы для `npm run api:types`; можно указать адрес `openapi.json` работающего бэкенда |
| `E2E_BASE_URL` | пусто | Адрес уже запущенного фронтенда для `npm run e2e`; без него Playwright сам поднимает Vite на порту 5179 |
| `E2E_BROWSER_EXECUTABLE` | пусто | Путь к своему Chromium для `npm run e2e` |
| `COMPOSE_PROJECT_NAME` | `hotel-agent` | Имя проекта Compose и префикс образов |
| `TAG` | `latest` | Тег образов |
| `SITE_URL` | пусто | Адрес сайта для мета-тегов при сборке фронтенда |

Неверное значение `LLM_PROVIDER`, `LLM_TIMEOUT_S` или `ETG_ENVIRONMENT` останавливает запуск
бэкенда с `ConfigError`, где названа переменная.

## Как проверить бэкенд?

Из корня:

```bash
make check
```

`make check` запускает `ruff check`, `ruff format --check`, `mypy` в режиме `strict`,
`lint-imports`, затем `pytest tests/unit` и `pytest tests/contract`. Обе группы тестов работают без
базы и сети. `make test-integration` требует PostgreSQL с PostGIS и бинарь `dbmate`
(`DBMATE_BIN`, если его нет в `PATH`). Часть тестов читает загруженный срез стенда по
`DATABASE_URL`; тесты отельера и каталога создают отдельную временную базу на том же сервере,
применяют к ней все миграции и удаляют её после прогона. Число процессов pytest-xdist выбирается
автоматически.

`lint-imports` проверяет правило зависимостей слоёв по контрактам из `backend/pyproject.toml`, то же
правило независимо проверяет `tests/unit/architecture/`. `tests/contract` проверяет, что
`docs/api/openapi.yaml` валиден и что каждый путь бэкенда в нём есть ([API](api.md#где-спецификация)).

## Как проверить фронтенд?

```bash
cd frontend
npm run verify
npm run e2e
```

`npm run verify` проверяет правила кода, CSS, текстов и движения, типы, Biome, запускает Vitest и
собирает приложение. `npm run e2e` сам поднимает dev-сервер Vite и запускает Playwright; браузер
Chromium должен быть установлен (`npx playwright install chromium`). Поиск, отели и ответы отельера
в сценариях подменяются ответами по контракту, а метаданные, карта и погода запрашиваются у
работающего бэкенда по `API_URL`. Часть сценариев намеренно запускает браузер без WebGL и проверяет
резервное состояние карты.

## Что делать, если не запускается?

| Симптом | Что проверить |
|---|---|
| `Cannot connect to the Docker daemon` | Docker не запущен |
| `No such image` при `docker compose up` | Образы не собраны: `make build` с теми же `COMPOSE_PROJECT_NAME` и `TAG` |
| Порт 8080, 8000 или 5432 занят | Задайте свободный `FRONTEND_PORT`, `BACKEND_PORT` или `POSTGRES_PORT` в `.env` |
| `uv: command not found` при `make seed` | `make seed`, `make precompute` и `make api` запускаются на хосте и требуют uv |
| Чат отвечает, но отелей нет, карта пустая | Срез не загружен: `make seed && make precompute` |
| Ошибка API в интерфейсе | `docker compose ps backend` и `docker compose logs --tail=50 backend`; затем `API_UPSTREAM` |
| `ConfigError` при старте бэкенда | Значение переменной из сообщения; допустимые значения перечислены там же |
| `LLM_PROVIDER=anthropic is not implemented yet` | Адаптера нет: оставьте `fake` или `openai_compat` |
| `LLM_PROVIDER=openai_compat needs LLM_*` | Для живой модели нужны все три переменные: адрес, ключ и модель |
| `ETG_KEY_ID and ETG_API_KEY must be configured together` | Задайте обе переменные или ни одной |
| Чат отвечает `503`, в логе `model_failure` | Основная и резервная модель не ответили или вернули ошибку; при `Language model returned HTTP 401` проверьте ключ |
| `InvalidRegistry: ... is not a directory` | `CHARACTERISTICS_DIR` не указывает на каталог с YAML реестра |
| Погода «недоступна» | Нет сети до Open-Meteo или дата дальше 15 дней от сегодня |
| Зависимости не скачиваются | Доступ к реестрам npm, PyPI и Docker во время сборки |

---

<sub>[Оглавление документации](README.md) · [README проекта](../README.md)</sub>
