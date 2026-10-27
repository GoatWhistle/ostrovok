import hashlib
import json
import time
from collections import OrderedDict
from typing import Any

from hotel_agent.adapters.llm.completion import Completion
from hotel_agent.application.ports.log import LoggerPort

TTL_S = 3600.0
CAPACITY = 512


def fingerprint(system: str, user: str, schema: dict[str, Any] | None) -> str:
    payload = json.dumps([system, user, schema], ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


class CachedCompletion:
    def __init__(
        self,
        inner: Completion,
        logger: LoggerPort,
        ttl_s: float = TTL_S,
        capacity: int = CAPACITY,
    ) -> None:
        self._inner, self._logger = inner, logger
        self._ttl, self._capacity = ttl_s, capacity
        self._entries: OrderedDict[str, tuple[float, str]] = OrderedDict()

    @property
    def provider(self) -> str:
        return self._inner.provider

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        planning: bool = False,
    ) -> str:
        if planning:
            return await self._inner.complete(
                system=system, user=user, schema=schema, planning=True
            )
        key = fingerprint(system, user, schema)
        stored = self._stored(key)
        if stored is not None:
            self._logger.info("llm_cache_hit", provider=self.provider, entries=len(self._entries))
            return stored
        content = await self._inner.complete(system=system, user=user, schema=schema)
        self._keep(key, content)
        return content

    async def aclose(self) -> None:
        await self._inner.aclose()

    def _stored(self, key: str) -> str | None:
        found = self._entries.get(key)
        if found is None:
            return None
        kept_at, content = found
        if time.monotonic() - kept_at > self._ttl:
            del self._entries[key]
            return None
        self._entries.move_to_end(key)
        return content

    def _keep(self, key: str, content: str) -> None:
        self._entries[key] = (time.monotonic(), content)
        self._entries.move_to_end(key)
        while len(self._entries) > self._capacity:
            self._entries.popitem(last=False)
