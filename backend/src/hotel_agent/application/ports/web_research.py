from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class WebPage:
    url: str
    title: str
    text: str
    retrieved_at: datetime


class WebResearchPort(Protocol):
    async def search(self, query: str) -> Sequence[WebPage]: ...

    async def read(self, url: str) -> WebPage: ...
