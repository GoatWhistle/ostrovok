import asyncio
import json
import re
from collections.abc import Mapping
from dataclasses import asdict, replace
from typing import Any

from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_research import (
    PlaceResearchPort,
    PlaceResearchRequest,
    PlaceResearchResult,
)
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort


class EventVenueResearch:
    def __init__(
        self,
        provider: PlaceResearchPort,
        web: WebResearchPort,
        uow: UnitOfWorkFactory,
        llm: LLMPort,
        city: str,
        bbox: tuple[float, float, float, float],
    ) -> None:
        self._provider, self._web, self._uow, self._llm = provider, web, uow, llm
        self._city, self._bbox = city, bbox

    async def research(self, request: PlaceResearchRequest) -> PlaceResearchResult:
        page = await self._web.read(request.url)
        pages = [page]
        if not page.events:
            hits = await self._web.search(f"{request.query or page.title[:160]} {self._city}")
            urls = list(dict.fromkeys(h.url for h in hits if h.url != page.url))[:3]
            found = await asyncio.gather(
                *(self._web.read(url) for url in urls), return_exceptions=True
            )
            pages.extend(p for p in found if isinstance(p, WebPage) and p.events)
        records: list[dict[str, Any]] = []
        for source in pages:
            events = []
            for event in source.events[:6]:
                place = event.get("location")
                if not isinstance(place, dict):
                    continue
                if not place.get("geo"):
                    venue = await self._resolve(str(place.get("name") or ""), source)
                    if venue is None:
                        continue
                    place = {**place, "geo": {"longitude": venue[0], "latitude": venue[1]}}
                events.append({**event, "location": place})
            if events:
                result = await self._provider.research(
                    replace(request, page=replace(source, events=tuple(events)), url=source.url)
                )
                records.extend(result.records)
        return PlaceResearchResult(
            records=tuple(records),
            sources=tuple(p.url for p in pages),
            note="Event venue matched to stored map objects where coordinates were missing. Date-only evidence does not establish exact show time. No room or ticket availability check.",
        )

    async def _resolve(self, name: str, page: WebPage) -> tuple[float, float] | None:
        if not name:
            return None
        tokens = sorted(set(re.findall(r"[^\W\d_]{3,}", name)), key=lambda x: (-len(x), x))[:5]
        candidates = {}
        async with self._uow() as uow:
            for query in [name, *tokens]:
                for candidate in await uow.named_places.candidates(
                    query, self._bbox, "amenity", ()
                ):
                    candidates[candidate.id] = candidate
        if not candidates:
            return None
        sources = {
            key: json.dumps(asdict(value), ensure_ascii=False) for key, value in candidates.items()
        }
        verdicts = await self._llm.verify_evidence(
            json.dumps(
                {
                    "mode": "landmark_identity",
                    "request": f"Площадка {name}, город {self._city}. Страница события: {page.text[:4000]}",
                    "records": [
                        {"record_id": key, "source_text": value} for key, value in sources.items()
                    ],
                },
                ensure_ascii=False,
            )
        )
        selected = {
            v.record_id
            for v in verdicts
            if v.supported
            and v.record_id in sources
            and len(v.quote.strip()) >= 12
            and v.quote in sources[v.record_id]
        }
        if len(selected) != 1:
            return None
        return candidates[next(iter(selected))].location


def event_providers(
    providers: Mapping[str, PlaceResearchPort],
    web: WebResearchPort | None,
    uow: UnitOfWorkFactory,
    llm: LLMPort | None,
    city: str,
    bbox: tuple[float, float, float, float] | None,
) -> Mapping[str, PlaceResearchPort]:
    provider = providers.get("read_event_page")
    if provider is None or web is None or llm is None or bbox is None:
        return providers
    return {**providers, "read_event_page": EventVenueResearch(provider, web, uow, llm, city, bbox)}
