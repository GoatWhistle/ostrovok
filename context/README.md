# Project context

Factmap: поиск отелей по пожеланиям с объяснениями и данными на карте. P0: тихий номер,
вид на закат и близость моря. Организаторские поля пока не заполнены в `brief/`.

Источник формы API: [OpenAPI](../docs/api/openapi.yaml). Состояние и инструкции:
[SESSION](SESSION.md), [вопросы](open-questions.md).

| Topic | Status | Evidence |
|---|---|---|
| Цикл пожеланий, поиск номеров и смысловая проверка ответа | implemented, locally tested | [Механизм](../docs/wish-agent.md), [475 backend checks](../docs/evidence.md#смысловая-проверка-ответа-26-октября-2026) |
| Основной стенд :8080 | previous verified version | [Прежние измерения](../docs/evidence.md); новый цикл не развёрнут, Claude не запускать |
| Данные и карта | previous verified state | [Полные прежние факты](../work/per-wish-agent/context-before.md) |

[Документация](../docs/README.md), [рабочие материалы](../work/README.md),
[предыдущая сессия](../work/per-wish-agent/session-before.md).
