import asyncio
import time
from typing import Any

import httpx

from hotel_agent.adapters.llm.attempt_budget import AttemptBudget
from hotel_agent.adapters.llm.payload import content_of
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.domain.errors import ModelFailure

HEDGE_PLANNING_S = 8.0
HEDGE_S = 12.0


class OpenAICompletion:
    def __init__(
        self,
        *,
        logger: LoggerPort,
        base_url: str,
        api_key: str,
        model: str,
        fallback_model: str | None = None,
        planning_model: str | None = None,
        timeout_s: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._logger = logger
        self._model = model
        self._fallback_model = fallback_model
        self._planning_model = planning_model
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

    def _candidates(self, planning: bool) -> tuple[str, str]:
        if planning and self._planning_model:
            return (self._planning_model, self._model)
        return (self._model, self._fallback_model or self._model)

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
        shape = "structured" if schema is not None else "text"
        models = self._budget.order(self._candidates(planning))
        if models[0] == models[1]:
            return await self._twice(request, models[0], shape)
        if planning:
            return await self._race(request, models, planning, shape)
        return await self._chain(request, models, shape)

    async def _twice(self, request: dict[str, Any], model: str, shape: str) -> str:
        try:
            return await self._ask(request, model)
        except ModelFailure as error:
            self._retrying(model, str(error), shape, hedged=False)
            await asyncio.sleep(0.2)
            return await self._ask(request, model)

    async def _chain(self, request: dict[str, Any], models: tuple[str, ...], shape: str) -> str:
        failure: ModelFailure | None = None
        order = (*models, models[0])
        for attempt, model in enumerate(order):
            try:
                return await self._ask(request, model)
            except ModelFailure as error:
                failure = error
                self._retrying(model, str(error), shape, hedged=False)
                if attempt + 1 < len(order):
                    await asyncio.sleep(0.2 * (attempt + 1))
        raise failure or ModelFailure("Language model is unreachable")

    async def _race(
        self, request: dict[str, Any], models: tuple[str, ...], planning: bool, shape: str
    ) -> str:
        floor = HEDGE_PLANNING_S if planning else HEDGE_S
        delay: float | None = self._budget.hedge_after(models[0], floor=floor)
        attempts = {self._ask_task(request, models[0]): models[0]}
        running = set(attempts)
        started = 1
        failure: ModelFailure | None = None
        try:
            while running or started < len(models):
                if not running:
                    task = self._ask_task(request, models[started])
                    attempts[task] = models[started]
                    running, started, delay = {task}, started + 1, None
                done, running = await asyncio.wait(
                    running, timeout=delay, return_when=asyncio.FIRST_COMPLETED
                )
                delay = None
                if not done and started < len(models):
                    self._retrying(models[0], f"slower than {floor:.0f}s", shape, hedged=True)
                    task = self._ask_task(request, models[started])
                    attempts[task] = models[started]
                    running.add(task)
                    started += 1
                    continue
                for task in done:
                    error = task.exception()
                    if error is None:
                        return task.result()
                    failure = error if isinstance(error, ModelFailure) else ModelFailure(str(error))
                    self._retrying(attempts[task], str(failure), shape, hedged=False)
        finally:
            for task in running:
                task.cancel()
        raise failure or ModelFailure("Language model is unreachable")

    def _ask_task(self, request: dict[str, Any], model: str) -> "asyncio.Task[str]":
        return asyncio.create_task(self._ask(request, model))

    async def _ask(self, request: dict[str, Any], model: str) -> str:
        limit = self._budget.timeout(model, initial=self._timeout_s)
        started = time.monotonic()
        try:
            response = await self._client.post(
                "/chat/completions", json={**request, "model": model}, timeout=limit
            )
            response.raise_for_status()
        except httpx.TimeoutException as error:
            self._budget.stalled(model, limit)
            raise ModelFailure(f"Language model is unreachable: {type(error).__name__}") from error
        except httpx.HTTPStatusError as error:
            raise ModelFailure(
                f"Language model returned HTTP {error.response.status_code}"
            ) from error
        except httpx.HTTPError as error:
            raise ModelFailure(f"Language model is unreachable: {type(error).__name__}") from error
        self._budget.answered(model, time.monotonic() - started)
        return content_of(response.json())

    def _retrying(self, model: str, cause: str, shape: str, *, hedged: bool) -> None:
        self._logger.warning(
            "llm_request_hedged" if hedged else "llm_request_retry",
            provider=self.provider,
            model=model,
            cause=cause,
            fallback=bool(self._fallback_model),
            response=shape,
        )
