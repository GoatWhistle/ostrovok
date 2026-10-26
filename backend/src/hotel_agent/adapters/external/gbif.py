from datetime import UTC, date, datetime
from math import cos, isfinite, radians

import httpx

from hotel_agent.adapters.external.public_json import public_json
from hotel_agent.application.ports.place_research import PlaceResearchRequest, PlaceResearchResult
from hotel_agent.application.spatial_matching import distance_m

API = "https://api.gbif.org/v1"
LICENSES = {
    "http://creativecommons.org/licenses/by/4.0/",
    "https://creativecommons.org/licenses/by/4.0/",
    "http://creativecommons.org/publicdomain/zero/1.0/",
    "https://creativecommons.org/publicdomain/zero/1.0/",
}


class GBIFObservations:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._client = httpx.AsyncClient(timeout=8, transport=transport)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def research(self, request: PlaceResearchRequest) -> PlaceResearchResult:
        if not request.query.strip() or len(request.query) > 200:
            raise ValueError("Supply a scientific taxon name of 1–200 characters")
        match = await public_json(
            self._client, f"{API}/species/match", {"name": request.query, "strict": "true"}
        )
        key = match.get("acceptedUsageKey") or match.get("usageKey")
        if (
            match.get("matchType") != "EXACT"
            or float(match.get("confidence", 0)) < 95
            or not isinstance(key, int)
        ):
            raise ValueError("Taxon name is ambiguous or not an exact GBIF match")
        lon, lat = request.location
        dy = request.radius_m / 110000
        dx = dy / max(cos(radians(lat)), 0.01)
        if not -180 < lon - dx < lon + dx < 180 or not -90 < lat - dy < lat + dy < 90:
            raise ValueError("GBIF search crossing the date line or poles is unsupported")
        geometry = f"POLYGON(({lon - dx} {lat - dy},{lon + dx} {lat - dy},{lon + dx} {lat + dy},{lon - dx} {lat + dy},{lon - dx} {lat - dy}))"
        payload = await public_json(
            self._client,
            f"{API}/occurrence/search",
            {
                "taxonKey": str(key),
                "hasCoordinate": "true",
                "hasGeospatialIssue": "false",
                "geometry": geometry,
                "limit": "100",
            },
        )
        records = []
        today = datetime.now(UTC).date()
        for raw in payload.get("results", [])[:100]:
            if not isinstance(raw, dict) or raw.get("basisOfRecord") not in {
                "HUMAN_OBSERVATION",
                "MACHINE_OBSERVATION",
            }:
                continue
            if raw.get("license") not in LICENSES or raw.get("occurrenceStatus") != "PRESENT":
                continue
            try:
                point = (float(raw["decimalLongitude"]), float(raw["decimalLatitude"]))
                uncertainty = float(raw["coordinateUncertaintyInMeters"])
                when = date.fromisoformat(str(raw["eventDate"])[:10])
                record_id = int(raw["key"])
            except (ValueError, KeyError, TypeError):
                continue
            if not all(isfinite(v) for v in (*point, uncertainty)) or uncertainty < 0:
                continue
            if not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90:
                continue
            distance = distance_m(request.location, point)
            if (
                when > today
                or uncertainty > min(request.radius_m, 1000)
                or distance + uncertainty > request.radius_m
            ):
                continue
            records.append(
                {
                    "source_url": f"https://www.gbif.org/occurrence/{record_id}",
                    "location": point,
                    "scientific_name": str(raw.get("scientificName", ""))[:300],
                    "date": when.isoformat(),
                    "distance_m": round(distance, 1),
                    "uncertainty_m": uncertainty,
                    "license": raw["license"],
                }
            )
        name = str(match.get("scientificName") or request.query)[:200]
        records.sort(key=lambda row: float(str(row["distance_m"])))
        sources = tuple(str(r["source_url"]) for r in records[:12])
        return PlaceResearchResult(
            descriptions={
                "observation_count": f"Исторических наблюдений {name} в радиусе {request.radius_m:g} м; CC0/CC BY, известная погрешность ≤1000 м, выборка до 100 записей; не обещает встречу с животным"
            },
            values={"observation_count": float(len(records))} if records else {},
            records=tuple(records[:12]),
            sources=sources,
            points=tuple(r["location"] for r in records[:12]),
            note="GBIF, CC0/CC BY 4.0 only. Historical observations; no records means unknown, not species absence. Counts are a bounded sample, not population size. Dates and uncertainty are in records.",
        )
