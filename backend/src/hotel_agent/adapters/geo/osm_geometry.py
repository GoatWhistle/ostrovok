import asyncio
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from xml.etree import ElementTree

import httpx
import osmium

from hotel_agent.application.ports.geography import GeographyContextPort
from hotel_agent.application.ports.view_geometry import PhysicalArea, PhysicalObject

OSM_ID = re.compile(r"([nwr])(\d+)$")
ELEMENTS = {"n": "node", "w": "way", "r": "relation"}


def physical_objects(payload: bytes) -> dict[str, tuple[dict[str, str], dict[str, Any]]]:
    factory = osmium.geom.GeoJSONFactory()
    objects = {}
    for item in (
        osmium.FileProcessor(osmium.io.FileBuffer(payload, "osm"))
        .with_locations("flex_mem")
        .with_areas()
    ):
        tags = dict(item.tags)
        if not tags:
            continue
        if isinstance(item, osmium.osm.Area):
            identifier = f"{'w' if item.from_way() else 'r'}{item.orig_id()}"
            geometry = json.loads(factory.create_multipolygon(item))
        elif isinstance(item, osmium.osm.Node) and item.location.valid():
            identifier = f"n{item.id}"
            geometry = {"type": "Point", "coordinates": [item.location.lon, item.location.lat]}
        elif isinstance(item, osmium.osm.Way) and not item.is_closed():
            identifier = f"w{item.id}"
            try:
                geometry = json.loads(factory.create_linestring(item))
            except RuntimeError:
                continue
        else:
            continue
        objects[identifier] = (tags, geometry)
    return objects


class OSMViewGeometry:
    def __init__(
        self,
        cache_dir: Path | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        context: GeographyContextPort | None = None,
    ) -> None:
        self._context = context
        self._cache = cache_dir
        if cache_dir is not None:
            cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(12, connect=3),
            transport=transport,
            headers={"User-Agent": "Factmap/0.1 (target geometry lookup)"},
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=4),
        )
        self._locks = tuple(asyncio.Lock() for _ in range(32))
        self._memory: dict[str, PhysicalObject] = {}
        self._areas: dict[str, PhysicalArea] = {}
        self._area_locks = tuple(asyncio.Lock() for _ in range(32))

    async def aclose(self) -> None:
        await self._client.aclose()

    async def object(self, identifier: str) -> PhysicalObject | None:
        match = OSM_ID.fullmatch(identifier)
        if match is None:
            raise ValueError("A valid OSM node/way/relation identifier is required")
        async with self._locks[hash(identifier) % len(self._locks)]:
            if identifier in self._memory:
                return self._memory[identifier]
            endpoint = f"https://api.openstreetmap.org/api/0.6/{ELEMENTS[match[1]]}/{match[2]}"
            if match[1] != "n":
                endpoint += "/full"
            path = self._cache / f"{identifier}.osm" if self._cache else None
            try:
                if path is not None and path.is_file():
                    payload = await asyncio.to_thread(path.read_bytes)
                else:
                    async with self._client.stream("GET", endpoint) as response:
                        response.raise_for_status()
                        body = bytearray()
                        async for chunk in response.aiter_bytes():
                            body.extend(chunk)
                            if len(body) > 32_000_000:
                                return None
                    payload = bytes(body)
                objects = await asyncio.to_thread(physical_objects, payload)
            except (httpx.HTTPError, RuntimeError, ValueError):
                return None
            if identifier not in objects:
                return None
            if path is not None and not path.is_file():
                temporary = path.with_suffix(".tmp")
                await asyncio.to_thread(temporary.write_bytes, payload)
                await asyncio.to_thread(temporary.replace, path)
            tags, geometry = objects[identifier]
            result = PhysicalObject(
                identifier,
                tags,
                geometry,
                f"https://www.openstreetmap.org/{ELEMENTS[match[1]]}/{match[2]}",
            )
            if len(self._memory) >= 256:
                self._memory.pop(next(iter(self._memory)))
            self._memory[identifier] = result
            return result

    async def area(self, bbox: tuple[float, float, float, float]) -> PhysicalArea | None:
        async with self._area_locks[hash(bbox) % len(self._area_locks)]:
            box = ",".join(f"{number:.6f}" for number in bbox)
            key = "area-" + box.replace(",", "-")
            path = self._cache / f"{key}.osm" if self._cache else None
            cached = None
            if key in self._areas or (path is not None and path.is_file()):
                cached = await self._area(bbox)
                if cached is not None and cached.complete:
                    return cached
            if self._context is not None:
                refreshed = await self._context.area(bbox)
                if refreshed is not None and refreshed.complete:
                    self._areas[key] = refreshed
                if refreshed is not None or cached is not None:
                    return refreshed if refreshed is not None else cached
            return await self._area(bbox)

    async def _area(self, bbox: tuple[float, float, float, float]) -> PhysicalArea | None:
        west, south, east, north = bbox
        if (
            not -180 <= west < east <= 180
            or not -85 <= south < north <= 85
            or (east - west) * (north - south) > 0.001
        ):
            raise ValueError("A small valid OSM map bounding box is required")
        box = ",".join(f"{number:.6f}" for number in bbox)
        key = "area-" + box.replace(",", "-")
        if key in self._areas:
            return self._areas[key]
        path = self._cache / f"{key}.osm" if self._cache else None
        url = "https://api.openstreetmap.org/api/0.6/map?" + urlencode({"bbox": box})
        try:
            if path is not None and path.is_file():
                payload = await asyncio.to_thread(path.read_bytes)
            else:
                async with self._client.stream("GET", url) as response:
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 12_000_000:
                            return None
                payload = bytes(body)
            objects = await asyncio.to_thread(physical_objects, payload)
            root = ElementTree.fromstring(payload)
        except (httpx.HTTPError, RuntimeError, ValueError, ElementTree.ParseError):
            return None
        missing = []
        for element in (*root.findall("relation"), *root.findall("way")):
            tags = {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}
            identifier = ("r" if element.tag == "relation" else "w") + element.attrib["id"]
            if (tags.get("building") or tags.get("building:part")) and identifier not in objects:
                missing.append(identifier)
        downloads = 0
        for identifier in missing:
            object_path = self._cache / f"{identifier}.osm" if self._cache else None
            cached = identifier in self._memory or (
                object_path is not None and object_path.is_file()
            )
            if not cached:
                if downloads >= 8:
                    continue
                downloads += 1
            recovered = await self.object(identifier)
            if recovered is not None:
                objects[identifier] = (recovered.tags, recovered.geometry)
        complete = all(identifier in objects for identifier in missing)
        buildings = tuple(
            PhysicalObject(identifier, tags, geometry, url)
            for identifier, (tags, geometry) in objects.items()
            if (
                tags.get("building") not in {None, "no"}
                or tags.get("building:part") not in {None, "no"}
            )
            and geometry["type"] in {"Polygon", "MultiPolygon"}
        )
        if path is not None and not path.is_file():
            temporary = path.with_suffix(".tmp")
            await asyncio.to_thread(temporary.write_bytes, payload)
            await asyncio.to_thread(temporary.replace, path)
        result = PhysicalArea(bbox, buildings, complete, url)
        if len(self._areas) >= 64:
            self._areas.pop(next(iter(self._areas)))
        self._areas[key] = result
        return result
