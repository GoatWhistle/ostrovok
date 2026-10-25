from collections.abc import Sequence
from typing import Protocol


class EmbeddingsPort(Protocol):
    async def embed(
        self, texts: Sequence[str], query: bool = False
    ) -> Sequence[Sequence[float]]: ...
