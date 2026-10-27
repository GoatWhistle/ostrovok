from datetime import date
from math import isfinite

import httpx

from hotel_agent.adapters.external.public_json import public_json
from hotel_agent.application.ports.place_research import PlaceResearchRequest, PlaceResearchResult
from hotel_agent.application.spatial_matching import distance_m

API = "https://commons.wikimedia.org/w/api.php"
MAX_RADIUS_M = 10000
FREE = ("cc0", "cc by", "cc-by", "public domain", "pd-")
NOTE = (
    "Wikimedia Commons geotagged media under a free licence. A photo near the hotel shows what"
    " exists around it, not what is visible from a room. Coordinates are the camera position"
    " declared by the author and may be wrong."
)


class CommonsPhotos:
    def __init__(self, user_agent: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._client = httpx.AsyncClient(
            timeout=8, headers={"User-Agent": user_agent}, transport=transport
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def research(self, request: PlaceResearchRequest) -> PlaceResearchResult:
        if request.radius_m > MAX_RADIUS_M:
            raise ValueError("Commons geosearch accepts a radius up to 10000 m")
        lon, lat = request.location
        payload = await public_json(
            self._client,
            API,
            {
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "generator": "geosearch",
                "ggscoord": f"{lat}|{lon}",
                "ggsradius": str(int(request.radius_m)),
                "ggslimit": "50",
                "ggsnamespace": "6",
                "prop": "imageinfo|coordinates",
                "iiprop": "url|extmetadata",
            },
        )
        records = [
            row
            for page in payload.get("query", {}).get("pages", [])
            if (row := _photo(page, request)) is not None
        ]
        records.sort(key=lambda row: float(str(row["distance_m"])))
        kept = records[:12]
        return PlaceResearchResult(
            descriptions={
                "photo_count": f"Фотографий с геометками в радиусе {request.radius_m:g} м,"
                " Wikimedia Commons, свободная лицензия; снимок рядом не доказывает вид из номера"
            },
            values={"photo_count": float(len(records))} if records else {},
            records=tuple(kept),
            sources=tuple(str(row["source_url"]) for row in kept),
            points=tuple(_point(row) for row in kept),
            note=NOTE,
        )


def _photo(page: object, request: PlaceResearchRequest) -> dict[str, object] | None:
    if not isinstance(page, dict):
        return None
    info = page.get("imageinfo") or [{}]
    coordinates = page.get("coordinates") or [{}]
    if not isinstance(info, list) or not isinstance(coordinates, list):
        return None
    licence = _licence(info[0] if isinstance(info[0], dict) else {})
    if not licence or not licence.casefold().startswith(FREE):
        return None
    try:
        point = (float(coordinates[0]["lon"]), float(coordinates[0]["lat"]))
        url = str(info[0]["descriptionurl"])
    except (KeyError, TypeError, ValueError, IndexError):
        return None
    if not all(isfinite(value) for value in point):
        return None
    distance = distance_m(request.location, point)
    if distance > request.radius_m:
        return None
    return {
        "source_url": url,
        "title": str(page.get("title", ""))[:200],
        "location": point,
        "distance_m": round(distance, 1),
        "licence": licence,
        **({"date": _taken(info[0])} if _taken(info[0]) else {}),
    }


def _licence(info: dict[str, object]) -> str:
    meta = info.get("extmetadata")
    if not isinstance(meta, dict):
        return ""
    short = meta.get("LicenseShortName")
    return str(short.get("value", ""))[:80] if isinstance(short, dict) else ""


def _taken(info: dict[str, object]) -> str:
    meta = info.get("extmetadata")
    if not isinstance(meta, dict):
        return ""
    raw = meta.get("DateTimeOriginal")
    text = str(raw.get("value", ""))[:10] if isinstance(raw, dict) else ""
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        return ""


def _point(row: dict[str, object]) -> tuple[float, float]:
    location = row["location"]
    assert isinstance(location, tuple)
    return location
