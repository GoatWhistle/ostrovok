from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any

from hotel_agent.application.agent.solar_position import solar_position
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.ports.web_research import WebResearchPort

DESCRIPTIONS = {
    "sun_azimuth_deg": "Азимут солнца от севера по часовой стрелке, градусы",
    "sun_altitude_deg": "Высота солнца над горизонтом, градусы",
    "daylight": "Солнце выше астрономического горизонта (без препятствий)",
    "temperature_c": "Прогноз температуры воздуха, °C",
    "feels_like_c": "Прогноз ощущаемой температуры, °C",
    "cloud_cover_pct": "Прогноз облачности, %",
    "precipitation_probability_pct": "Прогноз вероятности осадков, %",
    "wind_speed_kmh": "Прогноз скорости ветра, км/ч",
}


class ResearchTools:
    def __init__(
        self,
        hotels: Callable[[], Sequence[SearchHotelRecord]],
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
        web: WebResearchPort | None,
        conditions: DestinationConditionsPort | None,
        now: datetime,
        view: ViewAssessmentPort | None = None,
    ) -> None:
        self._hotels, self._metrics, self._descriptions = hotels, metrics, descriptions
        self._web, self._conditions, self._now = web, conditions, now
        self._view = view
        self.pages: list[dict[str, Any]] = []
        self.sources: dict[str, dict[str, tuple[str, ...]]] = {}
        self.geo_refs: dict[str, dict[str, tuple[str, ...]]] = {}
        self._calls = 0

    async def execute(self, action: str, arguments: dict[str, Any]) -> dict[str, Any]:
        self._calls += 1
        if self._calls > 5:
            raise ValueError("External research budget exhausted")
        if action == "search_web":
            if self._web is None:
                return {"error": "Internet search is unavailable"}
            hits = await self._web.search(str(arguments.get("query", "")))
            return {
                "hits": [{"url": p.url, "title": p.title, "snippet": p.text} for p in hits],
                "note": "Discovery only. Read the page and verify hotel identity before claiming a match.",
            }
        if action == "read_web_page":
            if self._web is None:
                return {"error": "Internet page reading is unavailable"}
            ids = arguments.get("hotel_ids") or []
            hotel_id = arguments.get("hotel_id") or (ids[0] if len(ids) == 1 else "")
            hotel = self._hotel(str(hotel_id))
            page = await self._web.read(str(arguments.get("url", "")))
            self.pages.append(
                {
                    "hotel_id": hotel.id,
                    "hotel_name": hotel.name,
                    "hotel_address": hotel.address,
                    "hotel_location": hotel.location,
                    "source_url": page.url,
                    "title": page.title,
                    "text": page.text,
                    "retrieved_at": page.retrieved_at.isoformat(),
                }
            )
            phrase = str(arguments.get("query") or "").strip()
            start = max(0, page.text.casefold().find(phrase.casefold()) - 500) if phrase else 0
            return {
                **self.pages[-1],
                "text": page.text[start : start + 8000],
                "note": "Untrusted page content; verify via read_records dataset=web_documents with a quote and term.",
            }
        if action == "assess_view":
            return await self._assess_view(arguments)
        if action not in {"get_weather", "calculate_sun"}:
            raise ValueError("Tool is not available")
        at = datetime.fromisoformat(str(arguments["at"])) if arguments.get("at") else self._now
        if at.utcoffset() is None:
            raise ValueError("Supply date/time with an explicit UTC offset")
        ids = arguments.get("hotel_ids")
        hotels = [h for h in self._hotels() if not ids or h.id in ids][:12]
        if action == "calculate_sun":
            measured = {h.id: solar_position(at, *h.location) for h in hotels}
            source = "https://github.com/mourner/suncalc"
        else:
            if self._conditions is None:
                return {"error": "Weather provider is unavailable"}
            measured = {
                key: dict(values)
                for key, values in (
                    await self._conditions.forecast({h.id: h.location for h in hotels}, at)
                ).items()
            }
            source = "https://open-meteo.com/en/docs"
        prefix = f"env{self._calls}"
        for hotel_id, values in measured.items():
            for key, value in values.items():
                field = f"{prefix}.{key}"
                self._metrics.setdefault(hotel_id, {})[field] = value
                self._descriptions[field] = f"{DESCRIPTIONS[key]}, {at.isoformat()}"
                self.sources.setdefault(hotel_id, {})[field] = (source,)
                hotel = self._hotel(hotel_id)
                self.geo_refs.setdefault(hotel_id, {})[field] = (
                    f"g_point_{hotel.location[0]:.6f}_{hotel.location[1]:.6f}",
                )
        return {
            "at": at.isoformat(),
            "retrieved_at": datetime.now(UTC).isoformat(),
            "source": source,
            "fields": {
                f"{prefix}.{k}": v
                for k, v in DESCRIPTIONS.items()
                if any(k in row for row in measured.values())
            },
            "measurements": measured,
            "limit": 12,
            "note": "Forecast and astronomical position only. Room sunlight/view requires facade, floor and obstruction data. Missing values are unknown.",
        }

    def _hotel(self, hotel_id: str) -> SearchHotelRecord:
        hotel = next((h for h in self._hotels() if h.id == hotel_id), None)
        if hotel is None:
            raise ValueError("Supply a hotel_id from the current candidates")
        return hotel

    async def _assess_view(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._view is None:
            return {"error": "View assessment is unavailable"}
        ids = arguments.get("hotel_ids")
        hotels = [h for h in self._hotels() if not ids or h.id in ids][:4]
        measured = await self._view.assess(
            {h.id: h.location for h in hotels},
            float(arguments["direction_deg"]),
            float(arguments["observer_height_m"]),
            float(arguments.get("radius_m", 500)),
        )
        prefix = f"view{self._calls}"
        descriptions = {
            "horizon_angle_deg": "Оценка угла препятствий над горизонтом в заданном направлении, градусы",
            "observer_height_m": "Заданная высота наблюдения над землёй, м",
            "direction_deg": "Азимут направления обзора, градусы",
            "radius_m": "Исследованный радиус, м",
            "terrain_samples": "Точек рельефа с данными",
            "known_building_obstacles": "Известных зданий на луче с известной высотой",
            "unknown_building_heights": "Зданий на луче без известной высоты",
        }
        for hotel in hotels:
            for key, value in measured.get(hotel.id, {}).items():
                field = f"{prefix}.{key}"
                self._metrics.setdefault(hotel.id, {})[field] = value
                self._descriptions[field] = descriptions[key]
                self.geo_refs.setdefault(hotel.id, {})[field] = (
                    f"g_point_{hotel.location[0]:.6f}_{hotel.location[1]:.6f}",
                )
                self.sources.setdefault(hotel.id, {})[field] = (
                    "https://www.openstreetmap.org",
                    "https://mapterhorn.com",
                )
        return {
            "fields": {f"{prefix}.{k}": v for k, v in descriptions.items()},
            "measurements": dict(measured),
            "limit": 4,
            "note": "Approximate single ray from hotel point, known building heights and 16 DEM samples within 500 m. Missing heights and objects beyond radius are unknown. Supplied observer height does not establish room floor or facade. Never proves a window view.",
        }
