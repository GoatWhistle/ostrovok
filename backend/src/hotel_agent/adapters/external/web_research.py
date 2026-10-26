import asyncio
import ipaddress
import socket
from collections.abc import Sequence
from datetime import UTC, datetime
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree

import httpx

from hotel_agent.adapters.external.event_records import EVENT_FIELDS, EVENT_TYPES
from hotel_agent.adapters.external.hotel_metadata import HotelMetadata
from hotel_agent.adapters.external.web_pages import PageText
from hotel_agent.application.ports.web_research import WebPage

SEARCH_URL = "https://freeserp.ai/api.php"
FALLBACK_SEARCH_URL = "https://www.bing.com/search"
MAX_BYTES = 1_000_000


async def public_url(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
        raise ValueError("A public HTTP(S) URL is required")
    if parsed.port not in {None, 80, 443}:
        raise ValueError("Only standard web ports are allowed")
    addresses = await asyncio.get_running_loop().getaddrinfo(
        parsed.hostname,
        parsed.port or (443 if parsed.scheme == "https" else 80),
        type=socket.SOCK_STREAM,
    )
    if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
        raise ValueError("Only public internet addresses are allowed")


class PublicWebResearch:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(7, connect=2),
            follow_redirects=False,
            headers={"User-Agent": "HotelAgent/0.1 (hotel information research)"},
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def search(self, query: str) -> Sequence[WebPage]:
        try:
            return await self._search(query)
        except httpx.HTTPError as error:
            raise ValueError("Internet search provider is unavailable") from error

    async def _search(self, query: str) -> Sequence[WebPage]:
        if not query.strip() or len(query) > 500:
            raise ValueError("Search query must contain 1–500 characters")
        try:
            response = await self._client.get(
                SEARCH_URL, params={"q": query, "index": "web", "size": 6}
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("ok") is True:
                return [
                    WebPage(
                        url=str(item["url"]),
                        title=str(item.get("title", "")),
                        text=str(item.get("snippet", ""))[:2000],
                        retrieved_at=datetime.now(UTC),
                    )
                    for item in payload.get("results", [])[:6]
                    if str(item.get("url", "")).startswith(("https://", "http://"))
                ]
        except (httpx.HTTPError, ValueError, TypeError):
            pass
        response = await self._client.get(FALLBACK_SEARCH_URL, params={"q": query, "format": "rss"})
        response.raise_for_status()
        try:
            root = ElementTree.fromstring(response.content[:MAX_BYTES])
        except ElementTree.ParseError as error:
            raise ValueError("Search provider returned an unreadable response") from error
        return [
            WebPage(
                url=item.findtext("link", ""),
                title=item.findtext("title", ""),
                text=item.findtext("description", "")[:2000],
                retrieved_at=datetime.now(UTC),
            )
            for item in root.findall("./channel/item")[:6]
            if item.findtext("link", "").startswith(("https://", "http://"))
        ]

    async def read(self, url: str) -> WebPage:
        try:
            return await self._read(url)
        except (httpx.HTTPError, TimeoutError, OSError) as error:
            raise ValueError("The internet page could not be read") from error

    async def _read(self, url: str) -> WebPage:
        async with asyncio.timeout(10):
            for _ in range(4):
                await public_url(url)
                async with self._client.stream("GET", url) as response:
                    if response.is_redirect:
                        url = urljoin(url, response.headers.get("location", ""))
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "")
                    if not any(kind in content_type for kind in ("text/html", "text/plain")):
                        raise ValueError("The page is not readable HTML or plain text")
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > MAX_BYTES:
                            raise ValueError("The page exceeds the 1 MB reading limit")
                    text = body.decode(response.encoding or "utf-8", errors="replace")
                    parser = PageText()
                    parser.feed(text)
                    metadata = HotelMetadata()
                    metadata.feed(text)
                    events = HotelMetadata(EVENT_TYPES, EVENT_FIELDS)
                    events.feed(text)
                    links = "\n".join(
                        f"{label}: {urljoin(url, href)}"
                        for href, label in parser.links[:40]
                        if label and href.startswith(("http://", "https://", "/"))
                    )
                    return WebPage(
                        url=url,
                        title=" ".join(parser.title)[:300],
                        text="\n".join(parser.parts)[:34000]
                        + metadata.evidence()
                        + ("\nСсылки на странице:\n" + links[:6000] if links else ""),
                        retrieved_at=datetime.now(UTC),
                        events=tuple(events.records),
                    )
        raise ValueError("Too many page redirects")
