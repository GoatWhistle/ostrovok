# Хранилище — PostgreSQL 16 с PostGIS, доступ сырым SQL через psycopg 3, миграции dbmate

Задача просит SQLAlchemy 2 (async) с asyncpg и Alembic. Выбран psycopg 3 с пулом и SQL-миграции
dbmate: геометрия живёт в PostGIS, и все запросы продукта (`ST_DWithin`, KNN по `<->`,
`ST_AsGeoJSON`, агрегация фасадов) пишутся прямо на SQL без обхода ORM через `text()`.

## Рассмотренные варианты

- **SQLAlchemy 2 + GeoAlchemy2 + Alembic:** отклонено — слой ORM для геозапросов приходится
  обходить, а `geoalchemy2` в списке стека задачи отсутствует и был бы ещё одной зависимостью
  поверх той, что всё равно не используется по назначению.
- **SQLite + SpatiaLite:** отклонено — нет KNN-индексов и оконных геофункций в нужном объёме,
  а стенд всё равно поднимается через Compose.

## Следствия

- Репозитории возвращают dataclass-DTO; драйверные строки, курсоры и соединения не пересекают порт.
- Схема меняется только файлами в `backend/migrations/postgres/`, созданными `dbmate new`.
- Образ PostGIS — `imresamu/postgis:16-3.4` (мультиарх): официальный `postgis/postgis:16-3.4`
  публикуется только под amd64 и на arm64-машинах разработки шёл бы через эмуляцию.
  Проверено: `docker compose exec db psql -c "select postgis_full_version()"` →
  `POSTGIS="3.4.3" PGSQL="160"`, архитектура образа `arm64`.

---

<sub>[Оглавление документации](../README.md) · [README проекта](../../README.md)</sub>
