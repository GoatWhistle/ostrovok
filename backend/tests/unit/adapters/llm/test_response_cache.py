from typing import Any

import pytest

from hotel_agent.adapters.llm.response_cache import CachedCompletion
from hotel_agent.adapters.log.stdlib import StdlibLogger


class CountingCompletion:
    def __init__(self) -> None:
        self.calls = 0

    @property
    def provider(self) -> str:
        return "counting"

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        planning: bool = False,
    ) -> str:
        self.calls += 1
        return f"{user}:{self.calls}"

    async def aclose(self) -> None:
        return None


def cached(ttl_s: float = 3600, capacity: int = 512) -> tuple[CachedCompletion, CountingCompletion]:
    inner = CountingCompletion()
    return CachedCompletion(inner, StdlibLogger("test"), ttl_s, capacity), inner


@pytest.mark.asyncio
async def test_an_identical_deterministic_request_is_answered_from_the_cache() -> None:
    completion, inner = cached()
    first = await completion.complete(system="s", user="u")
    second = await completion.complete(system="s", user="u")
    assert first == second
    assert inner.calls == 1


@pytest.mark.asyncio
async def test_a_different_schema_is_a_different_request() -> None:
    completion, inner = cached()
    await completion.complete(system="s", user="u", schema={"name": "a"})
    await completion.complete(system="s", user="u", schema={"name": "b"})
    assert inner.calls == 2


@pytest.mark.asyncio
async def test_planning_steps_are_never_served_from_the_cache() -> None:
    completion, inner = cached()
    await completion.complete(system="s", user="u", planning=True)
    await completion.complete(system="s", user="u", planning=True)
    assert inner.calls == 2


@pytest.mark.asyncio
async def test_an_expired_entry_is_requested_again() -> None:
    completion, inner = cached(ttl_s=-1)
    await completion.complete(system="s", user="u")
    await completion.complete(system="s", user="u")
    assert inner.calls == 2


@pytest.mark.asyncio
async def test_the_cache_drops_the_least_recently_used_entry() -> None:
    completion, inner = cached(capacity=2)
    await completion.complete(system="s", user="a")
    await completion.complete(system="s", user="b")
    await completion.complete(system="s", user="a")
    await completion.complete(system="s", user="c")
    await completion.complete(system="s", user="b")
    assert inner.calls == 4
