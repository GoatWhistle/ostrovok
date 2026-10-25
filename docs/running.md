# Запуск и проверки

Compose запускает PostGIS, миграции, бэкенд и фронтенд. У бэкенда сейчас два метода —
`GET /api/v1/health` и `GET /api/v1/characteristics`; поиск, карточка, сцена и геообъекты
добавляются следующими этапами.

**Читайте, если** вы запускаете шаблон · **Связано:** [архитектура](architecture.md) · [зависимости](dependencies.md)

## Как запустить через Docker?

Нужны Docker и Compose v2. Из корня репозитория:

```bash
cp .env.example .env
docker buildx bake
docker compose up -d --wait
```

Короткий путь через `make` из корня: `make up` собирает и поднимает весь стенд,
`make build` собирает образы, `make api` запускает API локально с перезагрузкой,
`make check` прогоняет линтеры и тесты. `make help` перечисляет цели.

Две команды ходят в сеть и запускаются вручную, их не вызывают ни `make seed`, ни тесты:
`make fetch-seed` скачивает исходный экстракт OSM и тайлы DEM в `data/raw/`,
`make llm-check` делает настоящий вызов к провайдеру из `.env` и тратит квоту.

`make build-seed` режет из скачанного срез Сочи в `data/seed/sochi/` и сети не требует. Он нужен
только при смене границ или обновлении данных: готовый срез лежит в репозитории.
На Apple M-серии полный проход по экстракту «Южный ФО» занимает около 7 минут.
После `make up` выполните `make seed`: он загружает готовый срез в PostGIS, повторный запуск
обновляет те же записи без дублей и не обращается к сети. Миграции применяет одноразовый сервис
`migrate` до запуска API. Для проверки схемы: `docker compose run --rm migrate`.

Интерфейс: http://localhost:8080, API: http://localhost:8000, Swagger: http://localhost:8000/docs.
Образы собирает только `docker-bake.hcl`; Compose берёт готовые образы
`<COMPOSE_PROJECT_NAME>-backend:<TAG>` и `<COMPOSE_PROJECT_NAME>-frontend:<TAG>` и не скачивает их
из реестра. Без сборки `docker compose up` остановится с ошибкой об отсутствующем образе.
Переменные контейнеров приходят из `.env` через `env_file`; без `.env` действуют значения по
умолчанию. Первичная сборка требует сети для загрузки зависимостей и образов.

Реестр характеристик (`characteristics/`) и демо-данные (`data/`) не попадают в образ: Compose
монтирует их в контейнер только для чтения по путям `/srv/characteristics` и `/srv/data`.
Поэтому образ бэкенда сам по себе не запускается без этих каталогов рядом.

Переменные сборки (`TAG`, `SITE_URL`, `COMPOSE_PROJECT_NAME`) bake берёт из окружения, а не из
`.env`.

## Как разрабатывать без Docker?

Нужны Node.js 22.18+ или поддерживаемая более новая версия и npm.

```bash
cd frontend
npm ci
npm run dev
```

Адрес покажет Vite при запуске. Бэкенд без Docker, из корня:

```bash
cd backend
uv sync
uv run uvicorn hotel_agent.main:create_app --factory --reload
```

## Какие переменные читает бэкенд?

Все необязательны: без них работает офлайн-реализация.

| Переменная | По умолчанию | Что задаёт |
|---|---|---|
| `LLM_PROVIDER` | `fake` | `fake` — детерминированный разбор на синонимах реестра, без ключа и без сети; `openai_compat` — живой OpenAI-совместимый endpoint; `anthropic` пока останавливает запуск с явной ошибкой |
| `LLM_API_KEY` | пусто | Ключ провайдера; в коде ключей нет. Обязателен для `openai_compat` |
| `ETG_KEY_ID`, `ETG_API_KEY` | пусто | Партнёрские реквизиты ETG/RateHawk для проверки тарифов; указываются вместе. Без них карточка честно сообщает, что доступность неизвестна |
| `ETG_ENVIRONMENT` | `sandbox` | `sandbox` или `production`; данные и ключи сред не смешиваются |
| `LLM_BASE_URL` | пусто | Адрес OpenAI-совместимого endpoint, например `https://llm.api.cloud.yandex.net/v1`. Обязателен для `openai_compat` |
| `LLM_MODEL` | пусто | Имя модели, например `gpt://<folder_id>/deepseek-v4.1-flash/latest`. Обязателен для `openai_compat` |
| `LLM_TIMEOUT_S` | `30` | Таймаут запроса к модели, секунды |
| `CHARACTERISTICS_DIR` | `characteristics` | Каталог реестра характеристик |
| `SEED_DIR` | `data/seed` | Каталог демо-данных |
| `DATABASE_URL` | `postgresql://hotel:hotel@localhost:5432/hotel` | Адрес PostgreSQL с PostGIS |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `hotel` | Учётные данные контейнера базы |
| `POSTGRES_PORT` | `5432` | Порт базы на хосте |
| `BACKEND_PORT` | `8000` | Порт бэкенда на хосте в Compose |
| `TAG` | `latest` | Тег образов Compose и bake |

Неизвестное значение останавливает запуск с ошибкой, где названа переменная и допустимые значения.

## Как проверить фронтенд и презентацию?

Из корня, каждую команду отдельно:

```bash
(cd frontend && npm run verify)
(cd presentation && npm ci && npm run build)
```

## Как проверить бэкенд?

Нужен [uv](https://docs.astral.sh/uv/). Из корня:

```bash
cd backend
uv sync
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run lint-imports
uv run pytest tests/unit
uv run pytest tests/contract
uv run pytest tests/integration
```

`tests/unit` и `tests/contract` работают без базы и сети; `tests/integration` требует локальную
инфраструктуру (PostgreSQL с PostGIS, `dbmate`, запущенный стенд) и пока пуст — пустая группа
выходит с кодом 5. `uv run lint-imports` проверяет правило зависимостей слоёв по контрактам из
`pyproject.toml`; то же правило независимо проверяет `tests/unit/architecture/`.
`tests/contract` валидирует ответы API против `docs/api/openapi.yaml`.
Число процессов pytest-xdist зависит от размера набора: маленький идёт в один процесс.

## Что делать, если не запускается?

| Симптом | Что проверить |
|---|---|
| Порт 8080 занят | Задайте свободный `FRONTEND_PORT` в `.env` |
| Порт 8000 занят | Задайте свободный `BACKEND_PORT` в `.env` |
| Ошибка состояния API | `docker compose ps backend` и `docker compose logs backend`; затем `API_UPSTREAM` |
| `ConfigError` при старте бэкенда | Значение переменной из сообщения; допустимые перечислены там же |
| `LLM_PROVIDER=anthropic is not implemented yet` | Адаптер ещё не написан: оставьте `fake` или `openai_compat` |
| `LLM_PROVIDER=openai_compat needs LLM_*` | Для живого провайдера нужны все три: адрес, ключ и модель |
| `Language model returned HTTP 401` | Ключ недействителен или у сервисного аккаунта нет роли `ai.languageModels.user` |
| `InvalidRegistry: ... is not a directory` | `CHARACTERISTICS_DIR` не указывает на каталог с YAML реестра |
| `Cannot connect to the Docker daemon` | Docker не запущен |
| `No such image` при `docker compose up` | Образы не собраны: `docker buildx bake` с теми же `COMPOSE_PROJECT_NAME` и `TAG` |
| Зависимости не скачиваются | Доступ к реестрам npm и Docker во время сборки |

---

<sub>[Оглавление документации](README.md) · [README проекта](../README.md)</sub>
