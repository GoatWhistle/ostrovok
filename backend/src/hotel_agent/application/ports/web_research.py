from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class WebPage:
    url: str
    title: str
    text: str
    retrieved_at: datetime
    events: tuple[dict[str, Any], ...] = ()


class WebResearchPort(Protocol):
    async def search(self, query: str) -> Sequence[WebPage]: ...

    async def read(self, url: str) -> WebPage: ...
