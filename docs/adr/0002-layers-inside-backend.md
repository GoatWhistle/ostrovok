# Слои — `domain / application / adapters / interfaces` внутри существующего `backend/`

Задача описывает отдельный корень `hotel-agent/` со своими Compose и Makefile. Код размещён в
готовом `backend/` с переименованием пакета `app` → `hotel_agent`, чтобы не держать в репозитории
два бэкенда и два Compose: Dockerfile, `docker-bake.hcl`, сервис Compose и проверки уже настроены
на `backend/`. Имена слоёв взяты из задачи.

## Следствия

- Правило зависимостей: `interfaces | adapters → application → domain`. Проверяется дважды —
  `uv run lint-imports` (контракты в `pyproject.toml`) и `tests/unit/architecture/`, который
  разбирает пакет через `ast` и ловит импорты в аннотациях, в теле функций и в `__init__.py`.
  Нарушение `domain → adapters` подтверждено временным импортом: обе проверки упали.
- Репозитории живут в `adapters/db/`, а не отдельным слоем: наружу они видны только через порты
  `application/ports/`.
- `main.py` остаётся точкой входа (`uvicorn hotel_agent.main:create_app --factory`), сборка
  зависимостей по окружению — в `composition.py`. Ни один слой не импортирует `main`,
  `composition` и `settings`; это третий контракт import-linter.
- Реестр характеристик (`characteristics/`) и демо-данные (`data/seed/`) лежат в корне репозитория
  и попадают в контейнер bind-монтированием только для чтения, а не в образ: срез Сочи весит
  десятки мегабайт. Пути задаются `CHARACTERISTICS_DIR` и `SEED_DIR`.

---

<sub>[Оглавление документации](../README.md) · [README проекта](../../README.md)</sub>
