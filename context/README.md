# Project context

Factmap: поиск отелей по пожеланиям с объяснениями и данными на карте. P0: тихий номер,
вид на закат и близость моря. Организаторские поля пока не заполнены в `brief/`.

Источник формы API: [OpenAPI](../docs/api/openapi.yaml). Состояние и инструкции:
[SESSION](SESSION.md), [вопросы](open-questions.md).

| Topic | Status | Evidence |
|---|---|---|
| Цикл пожеланий, поиск номеров и смысловая проверка ответа | implemented, locally tested | [Механизм](../docs/wish-agent.md), [649 backend checks](../docs/evidence.md#запуск-агентского-цикла-и-смысловой-проверки-26-октября-2026) |
| Основной стенд :8080 | verified, 2026-10-26 | Новый цикл и проверка ответа; Yandex DeepSeek, `agent-loop-stand-20261026b`. [Запуск](../work/stand-restart/README.md) |
| Данные и карта | previous verified state | [Полные прежние факты](../work/per-wish-agent/context-before.md) |

[Документация](../docs/README.md), [рабочие материалы](../work/README.md),
[предыдущая сессия](../work/per-wish-agent/session-before.md).
