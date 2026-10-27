from collections import OrderedDict
from collections.abc import Sequence

from hotel_agent.application.ports.embeddings import EmbeddingsPort

CAPACITY = 2048


class CachedEmbeddings:
    def __init__(self, inner: EmbeddingsPort, capacity: int = CAPACITY) -> None:
        self._inner = inner
        self._capacity = capacity
        self._vectors: OrderedDict[tuple[bool, str], Sequence[float]] = OrderedDict()

    async def embed(self, texts: Sequence[str], query: bool = False) -> Sequence[Sequence[float]]:
        missing = [text for text in dict.fromkeys(texts) if (query, text) not in self._vectors]
        if missing:
            for text, vector in zip(missing, await self._inner.embed(missing, query), strict=True):
                self._keep((query, text), vector)
        return [self._taken((query, text)) for text in texts]

    async def aclose(self) -> None:
        close = getattr(self._inner, "aclose", None)
        if close is not None:
            await close()

    def _taken(self, key: tuple[bool, str]) -> Sequence[float]:
        self._vectors.move_to_end(key)
        return self._vectors[key]

    def _keep(self, key: tuple[bool, str], vector: Sequence[float]) -> None:
        self._vectors[key] = vector
        self._vectors.move_to_end(key)
        while len(self._vectors) > self._capacity:
            self._vectors.popitem(last=False)
