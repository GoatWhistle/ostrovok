# Живой LLM — Yandex Cloud AI Studio через OpenAI-совместимый endpoint

Продукту нужен настоящий разбор запроса помимо офлайн-реализации `fake`. Доступ, который есть у
команды, — API-ключ сервисного аккаунта Yandex Cloud. Адаптер написан как провайдер-агностичный
`openai_compat` поверх `POST /chat/completions`; Yandex — его конфигурация, а не особый случай.

## Что проверено живым вызовом 2026-10-25

- Базовый адрес `https://llm.api.cloud.yandex.net/v1` и `https://ai.api.cloud.yandex.net/v1`
  отвечают одинаково; заголовок — `Authorization: Bearer <api-key>`, не `Api-Key`.
- Идентификатор модели — `gpt://<folder_id>/<модель>/latest`. Folder ID не нужен отдельной
  настройкой: он часть строки модели, поэтому адаптер остаётся провайдер-агностичным.
- `response_format: {"type": "json_schema", "json_schema": {"name", "strict": true, "schema"}}`
  поддерживается, ответ приходит валидным по схеме.
- `GET /v1/models` возвращает каталог, доступный ключу: `yandexgpt-5.1`, `yandexgpt-5-pro`,
  `yandexgpt-5-lite`, `gpt-oss-120b`, `gpt-oss-20b`, `qwen3.6-35b-a3b`, `deepseek-v4.1-flash`
  и эмбеддеры. По умолчанию выбран `yandexgpt-5.1`.

## Рассмотренные варианты

- **Нативный `foundationModels/v1/completion` с `Api-Key`:** отклонено — привязывает адаптер к
  одному вендору, хотя задача просит «любой OpenAI-совместимый endpoint».
- **Официальный SDK Yandex:** отклонено — лишняя зависимость ради одного POST-запроса, который
  уже покрыт `httpx`, и тот же SDK пришлось бы заменить для vLLM или GigaChat.

## Следствия

- `LLM_PROVIDER=openai_compat` требует `LLM_BASE_URL`, `LLM_API_KEY` и `LLM_MODEL`; без любого из
  них запуск останавливается с именем переменной.
- `LLM_PROVIDER=fake` остаётся значением по умолчанию: демо и весь `make test` не тратят квоту.
- Живой вызов — только `make llm-check`, вручную. Автотесты адаптера идут на `httpx.MockTransport`.
- Ключ живёт в `.env`, который в `.gitignore`. В `.env.example` только имена переменных и образцы
  адреса и строки модели.

---

<sub>[Оглавление документации](../README.md) · [README проекта](../../README.md)</sub>
