import asyncio
from typing import Any

import httpx
from jsonschema import ValidationError, validate

from hotel_agent.adapters.llm.anthropic_payload import content_of, output_schema
from hotel_agent.adapters.llm.payload import as_mapping
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure


class AnthropicCompletion:
    def __init__(
        self,
        *,
        logger: LoggerPort,
        api_key: str,
        model: str,
        timeout_s: float,
        base_url: str = "https://api.anthropic.com/v1",
        fallback_model: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._logger = logger
        self._model = model
        self._fallback_model = fallback_model
        self._timeout_s = timeout_s
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"x-api-key": api_key, "anthropic-version": "2026-10-21"},
            timeout=timeout_s,
            transport=transport,
        )

    @property
    def provider(self) -> str:
        return "anthropic"

    async def aclose(self) -> None:
        await self._client.aclose()

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        planning: bool = False,
    ) -> str:
        request: dict[str, Any] = {
            "model": self._model,
            "max_tokens": 2000 if planning else 4000,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        original = schema["json_schema"]["schema"] if schema is not None else None
        if original is not None:
            request["output_config"] = {
                "format": {"type": "json_schema", "schema": output_schema(original)}
            }
        for attempt, model in enumerate((self._model, self._fallback_model or self._model)):
            request["model"] = model
            try:
                timeout = (
                    min(self._timeout_s, 12)
                    if self._fallback_model and attempt == 0
                    else self._timeout_s
                )
                response = await self._client.post("/messages", json=request, timeout=timeout)
                response.raise_for_status()
                try:
                    result = content_of(response.json())
                except ValueError as error:
                    raise ModelFailure(
                        "Language model returned an invalid JSON response"
                    ) from error
                if original is not None:
                    try:
                        validate(as_mapping(result), original)
                    except ValidationError as error:
                        raise ModelFailure(
                            "Language model returned an answer outside the requested schema"
                        ) from error
                return result
            except (httpx.NetworkError, httpx.TimeoutException) as error:
                if attempt == 0:
                    self._retry(type(error).__name__)
                    await asyncio.sleep(0.2)
                    continue
                raise ModelFailure(
                    f"Language model is unreachable: {type(error).__name__}"
                ) from error
            except httpx.HTTPStatusError as error:
                if attempt == 0 and self._fallback_model and error.response.status_code >= 500:
                    self._retry(f"HTTP {error.response.status_code}")
                    continue
                raise ModelFailure(
                    f"Language model returned HTTP {error.response.status_code}"
                ) from error
            except httpx.HTTPError as error:
                raise ModelFailure(
                    f"Language model is unreachable: {type(error).__name__}"
                ) from error
        raise ModelFailure("Language model is unreachable")

    def _retry(self, cause: str) -> None:
        self._logger.warning(
            "llm_request_retry",
            provider=self.provider,
            cause=cause,
            fallback=bool(self._fallback_model),
        )
