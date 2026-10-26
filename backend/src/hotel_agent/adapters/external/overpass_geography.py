import asyncio
from time import monotonic
from xml.etree import ElementTree

import httpx
from shapely.errors import GEOSException

from hotel_agent.adapters.osm.geography_snapshot import parse_snapshot
from hotel_agent.application.ports.geography import GeographicBounds, GeographySnapshot

OVERPASS_URL = "https://overpass.private.coffee/api/interpreter"
KEYS = (
    "building(:part)?|highway|railway|natural|water|landuse|amenity|shop|leisure|tourism|"
    "historic|healthcare|office|craft|man_made|emergency|public_transport|aeroway|sport"
)


class OverpassGeography:
    def __init__(
        self, endpoint: str = OVERPASS_URL, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._endpoint = endpoint
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(18, connect=3),
            transport=transport,
            headers={"User-Agent": "Factmap/0.1 (https://github.com/GoatWhistle/o-hack)"},
        )
        self._download = asyncio.Lock()
        self._unavailable_until = 0.0

    async def aclose(self) -> None:
        await self._client.aclose()

    async def fetch(self, bbox: GeographicBounds) -> GeographySnapshot | None:
        west, south, east, north = bbox
        box = f"{south:.7f},{west:.7f},{north:.7f},{east:.7f}"
        query = (
            f"[out:xml][timeout:12][maxsize:33554432];"
            f'nwr[~"^({KEYS})$"~"."]({box});(._;>>;);out body;'
        )
        async with self._download:
            if monotonic() < self._unavailable_until:
                return None
            try:
                async with self._client.stream(
                    "POST", self._endpoint, data={"data": query}
                ) as response:
                    if response.status_code in {403, 406, 429, 503, 504}:
                        retry = response.headers.get("Retry-After", "300")
                        self._unavailable_until = monotonic() + (
                            max(300, min(int(retry), 3600)) if retry.isdecimal() else 300
                        )
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 12_000_000:
                            return None
                return await asyncio.to_thread(parse_snapshot, bytes(body), bbox, self._endpoint)
            except httpx.HTTPError:
                self._unavailable_until = max(self._unavailable_until, monotonic() + 30)
                return None
            except (
                ValueError,
                RuntimeError,
                ElementTree.ParseError,
                GEOSException,
            ):
                return None
