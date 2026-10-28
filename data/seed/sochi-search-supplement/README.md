# Дополнение карты Сочи

Реальные данные OpenStreetMap, © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. URL исходных API-снимков, области и SHA-256 в meta.json. Срез 28.10.2026. Категории выбраны для проверки поиска; данные не заменяют полный регион и не подтверждают свойства гостиничных номеров.

Из корня репозитория, с DATABASE_URL нужной БД:

```sh
PYTHONPATH=backend/src backend/.venv/bin/python backend/scripts/search_map_supplement.py data/seed/sochi-search-supplement
PYTHONPATH=backend/src backend/.venv/bin/python backend/scripts/search_map_supplement.py data/seed/sochi-search-supplement --apply
```

Первый вызов только считает изменения, второй применяет upsert одной транзакцией. Удалений нет; SHA-256 проверяется до записи каждого слоя. Для пересборки из исходных .osm и файлов sources.json / central-sources.json используйте --build-from DIR. Сырые XML не включены, их адреса и хеши сохранены в meta.json. Не используйте число incoming как число новых или изменённых строк. Результаты текущего применения и сравнение с резервной копией: work/search-map/ten-queries/data-audit.json.
