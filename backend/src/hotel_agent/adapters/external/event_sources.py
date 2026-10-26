from typing import Any

import httpx

from hotel_agent.adapters.external.event_records import event_record, timestamp
from hotel_agent.adapters.external.public_json import public_json
from hotel_agent.application.ports.place_research import PlaceResearchRequest, PlaceResearchResult
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.application.spatial_matching import distance_m

API = "https://kudago.com/public-api/v1.4"


class PublicEvents:
    def __init__(
        self, web: WebResearchPort, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._web = web
        self._client = httpx.AsyncClient(timeout=8, transport=transport)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def research(self, request: PlaceResearchRequest) -> PlaceResearchResult:
        if request.start is None or request.end is None:
            raise ValueError("Events require start and end with UTC offsets")
        if request.url:
            page = await self._web.read(request.url)
            records = self._records(page.events, request, page.url, True)
            sources = (page.url,)
        else:
            params = {
                "lat": str(request.location[1]),
                "lon": str(request.location[0]),
                "radius": str(int(request.radius_m)),
                "page_size": "20",
                "text_format": "plain",
            }
            if request.query:
                found = await public_json(
                    self._client,
                    f"{API}/search/",
                    {
                        **params,
                        "q": request.query,
                        "ctype": "event",
                    },
                )
                ids = [
                    str(r["id"])
                    for r in found.get("results", [])[:20]
                    if isinstance(r, dict) and isinstance(r.get("id"), int)
                ]
                if not ids:
                    return PlaceResearchResult(note="No indexed candidates; coverage is incomplete")
                params["ids"] = ",".join(ids)
            else:
                params.update(
                    actual_since=str(int(request.start.timestamp())),
                    actual_until=str(int(request.end.timestamp())),
                )
            params.update(
                fields="id,title,description,dates,place,site_url,is_free", expand="place,dates"
            )
            payload = await public_json(self._client, f"{API}/events/", params)
            records = self._records(
                payload.get("results", [])[:20], request, "https://kudago.com/", False
            )
            sources = ("https://docs.kudago.com/api/",)
        return PlaceResearchResult(
            records=tuple(records[:12]),
            sources=sources,
            note="KudaGo/public Event markup; partial coverage. Unknown cancellation status is not confirmed scheduled. Straight-line distance; no ticket availability guarantee.",
        )

    def _records(
        self, rows: Any, request: PlaceResearchRequest, source: str, schema: bool
    ) -> list[dict[str, Any]]:
        result = []
        for raw in rows:
            if not isinstance(raw, dict):
                continue
            record = event_record(raw, source, schema)
            if record is None:
                continue
            distance = distance_m(request.location, record["location"])
            if distance > request.radius_m:
                continue
            intervals = [{"start": raw.get("startDate"), "end": raw.get("endDate")}]
            if not schema:
                intervals = raw.get("dates", [])
            for interval in intervals[:20]:
                if not isinstance(interval, dict):
                    continue
                start, end = timestamp(interval.get("start")), timestamp(interval.get("end"))
                if interval.get("is_startless") or interval.get("is_endless"):
                    continue
                end_known = end is not None
                end = end or start
                if start is None or end is None or end < start:
                    continue
                assert request.start is not None and request.end is not None
                if (
                    start >= request.end
                    or end < request.start
                    or (end == request.start and end > start)
                ):
                    continue
                result.append(
                    {
                        **record,
                        "start": start.isoformat(),
                        "end": end.isoformat() if end_known else None,
                        "distance_m": round(distance, 1),
                    }
                )
        return result
