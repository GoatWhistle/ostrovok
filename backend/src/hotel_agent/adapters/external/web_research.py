import asyncio
import ipaddress
import re
import socket
from collections.abc import Sequence
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qsl, unquote, urljoin, urlsplit
from xml.etree import ElementTree

import httpx

from hotel_agent.adapters.external.event_records import EVENT_FIELDS, EVENT_TYPES
from hotel_agent.adapters.external.hotel_metadata import HotelMetadata
from hotel_agent.adapters.external.microdata import MicrodataHotels
from hotel_agent.adapters.external.web_pages import PageText
from hotel_agent.application.ports.web_research import WebPage

USER_AGENT = "HotelAgent/0.1 (+https://github.com/GoatWhistle/o-hack; hotel information research)"
DUCKDUCKGO_URL = "https://html.duckduckgo.com/html/"
SEARCH_URL = "https://freeserp.ai/api.php"
FALLBACK_SEARCH_URL = "https://www.bing.com/search"
MAX_BYTES = 1_000_000
SEARCH_TIMEOUT = 15.0
RESULT_LIMIT = 6
QUOTED = re.compile(r'"([^"]{2,80})"')
WORDS = re.compile(r"[^\W\d_]{3,}")


def prefixes(text: str) -> list[str]:
    return [word.casefold().replace("\u0451", "\u0435")[:4] for word in WORDS.findall(text)]


def relevant(hits: Sequence[WebPage], query: str) -> tuple[WebPage, ...]:
    phrases = [words for words in (prefixes(phrase) for phrase in QUOTED.findall(query)) if words]
    words = prefixes(query)
    if not phrases and not words:
        return tuple(hits)
    found = []
    for hit in hits:
        haystack = f"{hit.title} {hit.text} {hit.url}".casefold().replace("\u0451", "\u0435")
        if phrases:
            if any(all(word in haystack for word in phrase) for phrase in phrases):
                found.append(hit)
            continue
        matched = sum(1 for word in set(words) if word in haystack)
        if matched >= max(1, (len(set(words)) + 1) // 2):
            found.append(hit)
    return tuple(found)


class SearchResults(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[WebPage] = []
        self._field: str | None = None
        self._url = ""
        self._title: list[str] = []
        self._snippet: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        if "result__a" in classes:
            self._flush()
            self._url = _target(attributes.get("href") or "")
            self._field = "title"
        elif "result__snippet" in classes:
            self._field = "snippet"

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self._field = None

    def handle_data(self, data: str) -> None:
        if self._field == "title":
            self._title.append(data)
        elif self._field == "snippet":
            self._snippet.append(data)

    def results(self) -> tuple[WebPage, ...]:
        self._flush()
        return tuple(self.rows[:RESULT_LIMIT])

    def _flush(self) -> None:
        if self._url:
            self.rows.append(
                WebPage(
                    url=self._url,
                    title=" ".join("".join(self._title).split())[:300],
                    text=" ".join("".join(self._snippet).split())[:2000],
                    retrieved_at=datetime.now(UTC),
                )
            )
        self._url = ""
        self._title = []
        self._snippet = []


def _target(href: str) -> str:
    value = unescape(href)
    if value.startswith("//"):
        value = "https:" + value
    parsed = urlsplit(value)
    if parsed.path.startswith("/l/"):
        redirect = dict(parse_qsl(parsed.query)).get("uddg", "")
        value = unquote(redirect)
    return value if value.startswith(("http://", "https://")) else ""


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
            headers={"User-Agent": USER_AGENT},
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
        failures = 0
        for provider in (self._duckduckgo, self._freeserp, self._bing):
            try:
                hits = await provider(query)
            except (httpx.HTTPError, ValueError, TypeError, ElementTree.ParseError):
                failures += 1
                continue
            found = relevant(hits, query)
            if found:
                return found
        if failures == 3:
            raise ValueError("Internet search provider is unavailable")
        return ()

    async def _duckduckgo(self, query: str) -> Sequence[WebPage]:
        response = await self._client.post(
            DUCKDUCKGO_URL,
            data={"q": query, "kl": "ru-ru"},
            headers={"Accept": "text/html", "Accept-Language": "ru-RU,ru;q=0.9"},
            timeout=SEARCH_TIMEOUT,
        )
        response.raise_for_status()
        parser = SearchResults()
        parser.feed(response.text[:MAX_BYTES])
        return parser.results()

    async def _freeserp(self, query: str) -> Sequence[WebPage]:
        response = await self._client.get(
            SEARCH_URL,
            params={"q": query, "index": "web", "size": RESULT_LIMIT},
            timeout=SEARCH_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("ok") is not True:
            return ()
        return tuple(
            WebPage(
                url=str(item["url"]),
                title=str(item.get("title", "")),
                text=str(item.get("snippet", ""))[:2000],
                retrieved_at=datetime.now(UTC),
            )
            for item in payload.get("results", [])[:RESULT_LIMIT]
            if str(item.get("url", "")).startswith(("https://", "http://"))
        )

    async def _bing(self, query: str) -> Sequence[WebPage]:
        response = await self._client.get(
            FALLBACK_SEARCH_URL,
            params={"q": query, "format": "rss"},
            timeout=SEARCH_TIMEOUT,
        )
        response.raise_for_status()
        root = ElementTree.fromstring(response.content[:MAX_BYTES])
        return tuple(
            WebPage(
                url=item.findtext("link", ""),
                title=item.findtext("title", ""),
                text=item.findtext("description", "")[:2000],
                retrieved_at=datetime.now(UTC),
            )
            for item in root.findall("./channel/item")[:RESULT_LIMIT]
            if item.findtext("link", "").startswith(("https://", "http://"))
        )

    async def read(self, url: str) -> WebPage:
        try:
            return await self._read(url)
        except httpx.HTTPStatusError as error:
            raise ValueError(unreadable(error.response.status_code)) from error
        except (httpx.HTTPError, TimeoutError, OSError) as error:
            raise ValueError(
                "unreachable: the host did not return the page within the time limit"
            ) from error

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
                        raise ValueError(
                            f"unsupported_type: the page is {content_type or 'unknown'},"
                            " not HTML or plain text"
                        )
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > MAX_BYTES:
                            raise ValueError("too_large: the page exceeds the 1 MB reading limit")
                    charset = re.search(
                        rb'<meta[^>]+charset=["\']?([a-zA-Z0-9_-]+)', body[:8192], re.IGNORECASE
                    )
                    encoding = (
                        charset.group(1).decode("ascii")
                        if charset
                        else response.encoding or "utf-8"
                    )
                    try:
                        text = body.decode(encoding, errors="replace")
                    except LookupError:
                        text = body.decode("utf-8", errors="replace")
                    parser = PageText()
                    parser.feed(text)
                    metadata = HotelMetadata()
                    metadata.feed(text)
                    microdata = MicrodataHotels()
                    microdata.feed(text)
                    records = microdata.results()
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
                        + (microdata.evidence() if not metadata.records else "")
                        + ("\nСсылки на странице:\n" + links[:6000] if links else ""),
                        retrieved_at=datetime.now(UTC),
                        events=tuple(events.records),
                        hotels=tuple(metadata.records) + records,
                    )
        raise ValueError("unreachable: too many page redirects")


def unreadable(status: int) -> str:
    if status in {401, 403, 429}:
        return (
            f"blocked: the site refused automated reading with HTTP {status};"
            " this is not evidence about the hotel, use another source"
        )
    if status in {404, 410}:
        return f"missing: the page no longer exists (HTTP {status})"
    if status >= 500:
        return f"unavailable: the site returned HTTP {status}"
    return f"unreadable: the site returned HTTP {status}"
