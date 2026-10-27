import asyncio
import json
import time
from pathlib import Path

import httpx
import pytest

from hotel_agent.adapters.llm import openai_completion
from hotel_agent.adapters.llm.openai_compat import OpenAICompatLLM
from hotel_agent.adapters.llm.openai_completion import OpenAICompletion
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.ports.log import LogValue

CHARACTERISTICS = Path(__file__).resolve().parents[4].parent / "characteristics"


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


async def test_unparsable_planning_output_is_asked_again_from_the_main_model() -> None:
    asked: list[tuple[str, int]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        asked.append((str(body["model"]), int(body["max_tokens"])))
        content = (
            "Вот мой план действий."
            if len(asked) == 1
            else json.dumps({"action": "finish", "arguments": {}, "reason": "Нет подтверждений."})
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    llm = OpenAICompatLLM(
        registry=YamlCharacteristicRegistry.from_directory(CHARACTERISTICS),
        logger=SilentLogger(),
        base_url="https://example.com/v1",
        api_key="test",
        model="main",
        planning_model="quick",
        timeout_s=30,
        transport=httpx.MockTransport(handle),
    )

    step = await llm.explore_data('{"remaining_tool_calls": 4}')

    assert step.action == "finish"
    assert [model for model, _ in asked] == ["quick", "main"]
    assert [tokens for _, tokens in asked] == [2000, 4000]


async def test_a_judgement_call_never_races_the_spare_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(openai_completion, "HEDGE_S", 0.01)
    asked: list[str] = []

    async def handle(request: httpx.Request) -> httpx.Response:
        model = str(json.loads(request.content)["model"])
        asked.append(model)
        if model == "main":
            await asyncio.sleep(0.2)
        return httpx.Response(200, json={"choices": [{"message": {"content": model}}]})

    llm = completion(httpx.MockTransport(handle))

    assert await llm.complete(system="s", user="u", schema={"type": "json_object"}) == "main"
    assert asked == ["main"]
