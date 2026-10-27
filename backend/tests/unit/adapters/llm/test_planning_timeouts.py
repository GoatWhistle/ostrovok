import json

import httpx

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


async def test_a_planning_timeout_widens_the_next_attempt_for_the_same_model() -> None:
    attempts: list[tuple[str, float]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        model = str(json.loads(request.content)["model"])
        attempts.append((model, float(request.extensions["timeout"]["read"])))
        if model == "main":
            raise httpx.ReadTimeout("provider stalled", request=request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    llm = completion(httpx.MockTransport(handle))
    for _ in range(2):
        assert await llm.complete(system="s", user="u", planning=True) == "{}"

    assert [model for model, _ in attempts] == ["main", "spare", "main", "spare"]
    assert attempts[0][1] == 8
    assert attempts[2][1] == 12


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
