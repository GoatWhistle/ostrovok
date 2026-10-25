## Current state

- Ветка `feat/hotel-agent-mvp`, HEAD `7f68887`, продукт `fc0c774`; пока не push. Polza Qwen3 Embedding 8B: complete, все 34 087 отелей, 34 532 фрагмента, 4096D, индекс 238 МБ. `work/evals/semantic-index-audit.json`; ключ только .env. Не переиндексировать без новых исходных текстов.
- Новый frontend до origin 5330c04 собран и поднят :8080; 320 тестов, 8 браузерных сценариев 375/1440 RU/EN light/dark. Backend пока старый fc0c774 с индексом: очередная сборка новых исправлений exec 34754; после успеха recreate backend.
- 20 живых запросов закончены: 17 scope/API checks pass, context-underwater ложный матч адреса «Подводников», один 503 и zoo 504. Артефакт `work/evals/open-ended-20-results.json` не объявлять семантической точностью.
- Незакоммиченные исправления: независимая NLI-проверка текстовых доказательств с дословной цитатой; source-модули RecordReader/DocumentEvidence; off reasoning для parse/context; retry ConnectTimeout/ReadError; tool-вопрос не считается противоречием; мягкие предпочтения не обнуляют выдачу. Добавлены generic onsite_objects и measure_geometry(coastlines) для запроса Новороссийска. 298 тестов прошли до новых геотулзов; текущие gates exec 642… (см. tool history).
- Регрессия улица Подводников воспроизведена на fc0c774 через git archive /tmp; текущий тест проходит. Новороссийск: 49 кандидатов, 49 измерений; ресторан в здании «Капиталъ» w711007670, n6684194394; до моря 139 м. «Альянс» n9370206990 тоже с рестораном, но 9842 м от моря. Это реальные данные PostGIS, не провайдерная инвентаризация.

## Next actions and pitfalls

- Дождаться сборки/recreate backend. Docker registry однажды упал на auth; retry. Затем original underwater fresh/context и hammam (положительный контроль), NVR «на берегу моря в Новороссийске с рестораном» в существующем чате 9e98647c-333b-4e8a-a0b1-3150b19d4169. Старый пользовательский underwater chat 205e236b-1226-407e-bcb2-5ec0d3d805f4.
- Добавить тесты цитат/мягких предпочтений/false clarification и геометрии; проверить карту restaurant POI и coast refs. Zoo 504 — старый SQL nearby без tag index, требует расследования отдельно от NLI; один provider 503. В логах также Mapterhorn 404 (нерелевантно поиску).
- Документировать негативные результаты, продакт/docs+SESSION, commit/push без force. Исходные тексты не изменились от новых тулзов, весь готовый индекс переиспользуется. SESSION превышает цель из-за защищённых инструкций.
