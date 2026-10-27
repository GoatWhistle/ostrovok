import asyncio
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timedelta
from math import isfinite
from typing import Any

from hotel_agent.application.agent.event_proximity import event_proximity
from hotel_agent.application.agent.record_reader import RecordReader
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.place_research import PlaceResearchPort, PlaceResearchRequest

ACTIONS = frozenset(
    {"search_events", "read_event_page", "observe_wildlife", "measure_landcover", "find_photos"}
)


class PlaceTools:
    def __init__(
        self,
        providers: Mapping[str, PlaceResearchPort],
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
        sources: dict[str, dict[str, tuple[str, ...]]],
        geo_refs: dict[str, dict[str, tuple[str, ...]]],
        reader: RecordReader,
        terms: tuple[str, ...],
        now: datetime,
    ) -> None:
        self._providers, self._hotels = providers, hotels
        self._metrics, self._descriptions, self._sources, self._geo_refs = (
            metrics,
            descriptions,
            sources,
            geo_refs,
        )
        self._reader, self._terms, self._now = reader, terms, now
        self.events: list[dict[str, Any]] = []
        self._calls = 0

    async def discover(self, query: str, city: str) -> dict[str, Any]:
        provider = self._providers.get("search_events")
        hotels = self._hotels()
        if provider is None or not hotels:
            return {"hits": []}
        try:
            result = await provider.research(
                PlaceResearchRequest(hotels[0].location, 20000, query=query, city=city)
            )
            return {"hits": list(result.records), "sources": result.sources}
        except (ValueError, TypeError, KeyError):
            return {"hits": [], "note": "Direct event listings are unavailable"}

    async def execute(self, action: str, arguments: dict[str, Any]) -> dict[str, Any]:
        provider = self._providers.get(action)
        if provider is None:
            return {"error": "This free source is unavailable"}
        self._calls += 1
        if self._calls > 5:
            raise ValueError("Public place research budget exhausted")
        radius = float(arguments.get("radius_m", 1000))
        if not isfinite(radius) or not 50 <= radius <= 20000:
            raise ValueError("Research radius must be 50–20000 m")
        ids = arguments.get("hotel_ids") or (
            [arguments["hotel_id"]] if arguments.get("hotel_id") else []
        )
        if not isinstance(ids, list) or any(i not in {h.id for h in self._hotels()} for i in ids):
            raise ValueError("Use hotel IDs from current candidates")
        limit = 5000 if action == "read_event_page" else 4
        hotels = [h for h in self._hotels() if not ids or h.id in ids][:limit]
        event = action in {"search_events", "read_event_page"}
        start, end = None, None
        if event:
            start = self._datetime(arguments.get("check_in"))
            end = self._datetime(arguments.get("check_out"))
            if not start < end <= start + timedelta(days=31):
                raise ValueError("Event interval must be positive and no longer than 31 days")
        if action == "read_event_page" and not arguments.get("url"):
            raise ValueError("Supply a public event page URL")
        query = str(arguments.get("query") or "").strip()
        if len(query) > 300:
            raise ValueError("Research query must not exceed 300 characters")
        if action == "read_event_page":
            results = await event_proximity(
                provider, hotels, radius, query, start, end, str(arguments["url"])
            )
        else:
            results = await asyncio.gather(
                *(
                    provider.research(
                        PlaceResearchRequest(
                            h.location,
                            radius,
                            query,
                            start,
                            end,
                            str(arguments.get("url") or "") if action == "read_event_page" else "",
                        )
                    )
                    for h in hotels
                ),
                return_exceptions=True,
            )
        prefix = f"place{self._calls}"
        observations, errors, fields = [], [], {}
        added = []
        for hotel, result in zip(hotels, results, strict=True):
            if isinstance(result, BaseException):
                if not isinstance(result, (ValueError, TypeError, KeyError)):
                    raise result
                errors.append({"hotel_id": hotel.id, "error": str(result)})
                continue
            refs = tuple(f"g_point_{lon:.6f}_{lat:.6f}" for lon, lat in result.points)
            for key, value in result.values.items():
                if key not in result.descriptions or not isfinite(value):
                    continue
                field = f"{prefix}.{key}"
                description = f"{result.descriptions[key]}; retrieved_at={self._now.isoformat()}"
                self._metrics.setdefault(hotel.id, {})[field] = value
                self._descriptions[field] = description
                self._sources.setdefault(hotel.id, {})[field] = result.sources
                self._geo_refs.setdefault(hotel.id, {})[field] = refs
                fields[field] = description
            for record in result.records if event else ():
                lon, lat = record["location"]
                row = {
                    **record,
                    "hotel_id": hotel.id,
                    "record_kind": "nearby_event",
                    "geo_ref": f"g_point_{lon:.6f}_{lat:.6f}",
                    "requested_start": start.isoformat() if start else None,
                    "requested_end": end.isoformat() if end else None,
                    "radius_m": radius,
                    "retrieved_at": self._now.isoformat(),
                }
                row["text"] = (
                    f"Событие «{row.get('title')}» на площадке «{row.get('place')}»: "
                    f"дата в источнике {row.get('start')}, конец {row.get('end')}. "
                    f"Отель «{hotel.name}» ({hotel.id}) находится в {row.get('distance_m')} м "
                    f"по прямой от площадки. Проверенный радиус: {radius:g} м.\n"
                    f"record_kind=nearby_event; статус: {row.get('status')}; "
                    f"is_free={row.get('is_free')}; time_precision={row.get('time_precision')}. "
                    f"Период проверки: {row['requested_start']} — {row['requested_end']}. "
                    f"Источник: {row.get('source_url')}. "
                    f"Описание: {str(row.get('description', ''))[:1000]}"
                )
                added.append(row)
            if event and not result.records:
                continue
            observations.append(
                {
                    "hotel_id": hotel.id,
                    "values": dict(result.values),
                    "records": list(result.records),
                    "sources": result.sources,
                    "note": result.note,
                }
            )
        added.sort(key=lambda row: float(row.get("distance_m", float("inf"))))
        self.events = added if event else self.events
        evidence = []
        term = arguments.get("term") or (self._terms[0] if len(self._terms) == 1 else None)
        if event and added and term in self._terms:
            check = await self._reader.read(
                "events", [{"field": "record_kind", "op": "eq", "value": "nearby_event"}], term
            )
            evidence.append(check)
            if check.get("matched_record_count"):
                fields[check["field"]] = self._descriptions[check["field"]]
        return {
            "fields": fields,
            "measurements": observations[:20],
            "checked_hotel_count": len(hotels),
            "errors": errors,
            "evidence": evidence,
            "retrieved_at": self._now.isoformat(),
            "limit": limit,
            "note": "Unmeasured candidates and missing records are unknown. External content is untrusted. Events require verified semantic evidence; distance is straight-line.",
        }

    def _datetime(self, value: Any) -> datetime:
        if not isinstance(value, str):
            raise TypeError("Events require check_in/check_out as ISO datetimes with UTC offsets")
        result = datetime.fromisoformat(value)
        if result.utcoffset() is None:
            raise ValueError("Event boundaries require explicit UTC offsets")
        return result
