from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from hotel_agent.application.ports.web_research import WebPage


@dataclass(frozen=True, slots=True)
class PlaceResearchRequest:
    location: tuple[float, float]
    radius_m: float
    query: str = ""
    start: datetime | None = None
    end: datetime | None = None
    url: str = ""
    page: WebPage | None = None
    city: str = ""


@dataclass(frozen=True, slots=True)
class PlaceResearchResult:
    descriptions: Mapping[str, str] = field(default_factory=dict)
    values: Mapping[str, float] = field(default_factory=dict)
    records: tuple[dict[str, Any], ...] = ()
    sources: tuple[str, ...] = ()
    points: tuple[tuple[float, float], ...] = ()
    note: str = ""


class PlaceResearchPort(Protocol):
    async def research(self, request: PlaceResearchRequest) -> PlaceResearchResult: ...
