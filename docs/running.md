# Запуск и проверки

Compose запускает PostGIS, бэкенд и фронтенд. У бэкенда сейчас два метода —
`GET /api/v1/health` и `GET /api/v1/characteristics`; поиск, карточка, сцена, геообъекты,
миграции и демо-данные добавляются следующими этапами.

**Читайте, если** вы запускаете шаблон · **Связано:** [архитектура](architecture.md) · [зависимости](dependencies.md)

## Как запустить через Docker?

Нужны Docker и Compose v2. Из корня репозитория:

```bash
cp .env.example .env
docker buildx bake
docker compose up -d --wait
```

Короткий путь через `make` из корня: `make up` поднимает только базу и ждёт её готовности,
`make build` собирает образы, `make api` запускает API локально с перезагрузкой,
`make check` прогоняет линтеры и тесты. `make help` перечисляет цели.

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
| `LLM_PROVIDER` | `fake` | `fake` — детерминированный разбор на синонимах реестра, без ключа и без сети; `anthropic` и `openai_compat` пока останавливают запуск с явной ошибкой |
| `LLM_API_KEY` | пусто | Ключ провайдера; в коде ключей нет |
| `LLM_BASE_URL` | пусто | Адрес OpenAI-совместимого endpoint |
| `LLM_MODEL` | пусто | Имя модели у провайдера |
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
инфраструктуру (PostgreSQL с PostGIS, `dbmate`, запущенный стенд) и сейчас пуст — пустая группа
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
| `LLM_PROVIDER=anthropic is not implemented yet` | Адаптер ещё не написан: оставьте `LLM_PROVIDER=fake` |
| `InvalidRegistry: ... is not a directory` | `CHARACTERISTICS_DIR` не указывает на каталог с YAML реестра |
| `Cannot connect to the Docker daemon` | Docker не запущен |
| `No such image` при `docker compose up` | Образы не собраны: `docker buildx bake` с теми же `COMPOSE_PROJECT_NAME` и `TAG` |
| Зависимости не скачиваются | Доступ к реестрам npm и Docker во время сборки |

---

<sub>[Оглавление документации](README.md) · [README проекта](../README.md)</sub>
