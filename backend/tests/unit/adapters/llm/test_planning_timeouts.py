import asyncio
import json
import time

import httpx
import pytest

from hotel_agent.adapters.llm import openai_completion
from hotel_agent.adapters.llm.openai_completion import OpenAICompletion
from hotel_agent.application.ports.log import LogValue


class SilentLogger:
    def info(self, event: str, **fields: LogValue) -> None:
        return None

    def warning(self, event: str, **fields: LogValue) -> None:
        return None

    def error(self, event: str, *, exc: BaseException | None = None, **fields: LogValue) -> None:
        return None


def completion(handle: httpx.MockTransport) -> OpenAICompletion:
    return OpenAICompletion(
        logger=SilentLogger(),
        base_url="https://example.com/v1",
        api_key="test",
        model="main",
        fallback_model="spare",
        timeout_s=30,
        transport=handle,
    )


async def test_a_slow_model_is_hedged_with_the_spare_instead_of_waiting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(openai_completion, "HEDGE_PLANNING_S", 0.05)
    asked: list[str] = []

    async def handle(request: httpx.Request) -> httpx.Response:
        model = str(json.loads(request.content)["model"])
        asked.append(model)
        if model == "main":
            await asyncio.sleep(5)
        return httpx.Response(200, json={"choices": [{"message": {"content": model}}]})

    llm = completion(httpx.MockTransport(handle))
    started = time.monotonic()
    assert await llm.complete(system="s", user="u", planning=True) == "spare"
    assert time.monotonic() - started < 1
    assert asked == ["main", "spare"]


async def test_every_candidate_may_use_the_whole_timeout() -> None:
    limits: list[float] = []

    def handle(request: httpx.Request) -> httpx.Response:
        limits.append(float(request.extensions["timeout"]["read"]))
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    llm = completion(httpx.MockTransport(handle))
    assert await llm.complete(system="s", user="u", planning=True) == "{}"

    assert limits == [30]


async def test_a_persistently_stalling_model_lets_the_spare_answer_first() -> None:
    attempts: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        model = str(json.loads(request.content)["model"])
        attempts.append(model)
        if model == "main":
            raise httpx.ReadTimeout("provider stalled", request=request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    llm = completion(httpx.MockTransport(handle))
    for _ in range(4):
        assert await llm.complete(system="s", user="u", planning=True) == "{}"

    assert attempts[-1] == "spare"
    assert attempts.count("main") == 3


async def test_a_planning_model_answers_planning_steps_and_the_main_model_the_rest() -> None:
    used: list[tuple[bool, str]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        used.append(
            ("response_format" in body and body.get("max_tokens") == 2000, str(body["model"]))
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    llm = OpenAICompletion(
        logger=SilentLogger(),
        base_url="https://example.com/v1",
        api_key="test",
        model="main",
        fallback_model="spare",
        planning_model="quick",
        timeout_s=30,
        transport=httpx.MockTransport(handle),
    )

    await llm.complete(system="s", user="u", planning=True, schema={"type": "json_object"})
    await llm.complete(system="s", user="u", schema={"type": "json_object"})

    assert used == [(True, "quick"), (False, "main")]
