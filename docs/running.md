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

| Команда | Что делает | Сеть |
|---|---|---|
| `make up` | `docker buildx bake`, затем `docker compose up -d --wait`; миграции dbmate применяются до старта бэкенда | Для сборки образов |
| `make seed` | Загружает срез `data/seed/sochi` в PostGIS; повторный запуск обновляет те же записи без дублей | Нет |
| `make precompute` | Считает по загруженному срезу факты: высоту здания, уровень шума, пеший маршрут до моря, фасады | Нет |
| `make down` | Останавливает стенд, том с базой `db-data` остаётся | Нет |
| `make logs` | Логи всех сервисов | Нет |
| `make build` | Только сборка образов через `docker-bake.hcl` | Да |
| `make help` | Список целей | Нет |

Для ручной загрузки подтверждённого соответствия City Park Hotel и его категорий номеров
нужен тестовый или рабочий ключ `NUITEE_API_KEY` в игнорируемом `.env`. Команда обращается
к API поставщика и записывает реальный каталог в PostgreSQL:

```bash
set -a; . ./.env; set +a
DATABASE_URL=postgresql://hotel:hotel@localhost:5432/hotel \
  uv run --directory backend hotel-agent sync-nuitee \
  --hotel-id n736761646 --supplier-id lp552d8
```

Образы собирает только `docker-bake.hcl`. Compose берёт готовые образы
`<COMPOSE_PROJECT_NAME>-backend:<TAG>` и `<COMPOSE_PROJECT_NAME>-frontend:<TAG>` и не скачивает их
из реестра (`pull_policy: never`), поэтому `docker compose up` без сборки остановится с ошибкой об
отсутствующем образе. Переменные сборки `TAG`, `SITE_URL` и `COMPOSE_PROJECT_NAME` bake берёт из
окружения, а не из `.env`.

Реестр характеристик `characteristics/` и данные `data/` в образ не попадают: Compose монтирует их
только для чтения в `/srv/characteristics` и `/srv/data`. Образ бэкенда без этих каталогов рядом не
запускается.

## Как обновить демо-данные?

Готовый срез Сочи лежит в репозитории, эти команды нужны только при смене границ или обновлении
данных.

| Команда | Что делает | Сеть |
|---|---|---|
| `make fetch-seed` | Скачивает экстракт OSM «Южный ФО» с Geofabrik и два тайла Copernicus GLO-30 в `data/raw/` | Да |
| `make fetch-russia` | Докачивает полный OSM-снимок России в `data/raw/` и проверяет MD5; это не импорт в PostGIS | Да |
| `make build-seed` | Режет из `data/raw/` срез Сочи в `data/seed/sochi/` и печатает число объектов каждого слоя | Нет |

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
| `API_SCHEMA_URL` | `http://localhost:8000/openapi.json` | Источник схемы для `npm run api:types` |
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
базы и сети. `make test-integration` требует запущенный стенд с загруженным срезом: в
`tests/integration` один тест `test_seeded_search_and_geo_features`. Число процессов pytest-xdist
выбирается автоматически.

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
Chromium должен быть установлен (`npx playwright install chromium`).

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
| Чат отвечает `503`, в логе `model_failure` | Модель не ответила за `LLM_TIMEOUT_S` после одного повтора или вернула HTTP-ошибку; при `Language model returned HTTP 401` проверьте ключ |
| `InvalidRegistry: ... is not a directory` | `CHARACTERISTICS_DIR` не указывает на каталог с YAML реестра |
| Погода «недоступна» | Нет сети до Open-Meteo или дата дальше 15 дней от сегодня |
| Зависимости не скачиваются | Доступ к реестрам npm, PyPI и Docker во время сборки |

---

<sub>[Оглавление документации](README.md) · [README проекта](../README.md)</sub>
