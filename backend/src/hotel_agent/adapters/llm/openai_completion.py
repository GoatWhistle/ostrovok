import asyncio
import time
from typing import Any

import httpx

from hotel_agent.adapters.llm.attempt_budget import AttemptBudget
from hotel_agent.adapters.llm.payload import content_of
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure


class OpenAICompletion:
    def __init__(
        self,
        *,
        logger: LoggerPort,
        base_url: str,
        api_key: str,
        model: str,
        fallback_model: str | None = None,
        timeout_s: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._logger = logger
        self._model = model
        self._fallback_model = fallback_model
        self._timeout_s = timeout_s
        self._budget = AttemptBudget(ceiling_s=timeout_s)
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_s,
            transport=transport,
        )

    @property
    def provider(self) -> str:
        return "openai_compat"

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
            "temperature": 0,
            "reasoning_effort": "none",
            "max_tokens": 4000,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if planning:
            request.update(reasoning_effort="none", temperature=1, max_tokens=2000)
        if schema is not None:
            request["response_format"] = schema
        models = self._budget.order((self._model, self._fallback_model or self._model))
        for attempt, model in enumerate(models):
            request["model"] = model
            started = time.monotonic()
            try:
                initial = (
                    min(self._timeout_s, 12)
                    if self._fallback_model and attempt == 0
                    else self._timeout_s
                )
                if planning:
                    initial = min(initial, 8 if self._fallback_model and attempt == 0 else 18)
                limit = self._budget.timeout(model, initial=initial)
                response = await self._client.post("/chat/completions", json=request, timeout=limit)
                response.raise_for_status()
                self._budget.answered(model, time.monotonic() - started)
                return content_of(response.json())
            except (httpx.NetworkError, httpx.TimeoutException) as error:
                if isinstance(error, httpx.TimeoutException):
                    self._budget.stalled(model, limit)
                if attempt == 0:
                    self._logger.warning(
                        "llm_request_retry",
                        provider=self.provider,
                        cause=type(error).__name__,
                        fallback=bool(self._fallback_model),
                        response="structured" if schema is not None else "text",
                    )
                    await asyncio.sleep(0.2)
                    continue
                raise ModelFailure(
                    f"Language model is unreachable: {type(error).__name__}"
                ) from error
            except httpx.HTTPStatusError as error:
                if attempt == 0 and self._fallback_model and error.response.status_code >= 500:
                    self._logger.warning(
                        "llm_request_retry",
                        provider=self.provider,
                        cause=f"HTTP {error.response.status_code}",
                        fallback=True,
                    )
                    continue
                raise ModelFailure(
                    f"Language model returned HTTP {error.response.status_code}"
                ) from error
            except httpx.HTTPError as error:
                raise ModelFailure(
                    f"Language model is unreachable: {type(error).__name__}"
                ) from error
        raise ModelFailure("Language model is unreachable")
