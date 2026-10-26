import re
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from hotel_agent.adapters.external.web_pages import PageText
from hotel_agent.application.ports.place_research import PlaceResearchResult

CITIES = {"москва": "moscow", "санкт-петербург": "saint-petersburg"}


async def event_listings(client: httpx.AsyncClient, query: str, city: str) -> PlaceResearchResult:
    slug = CITIES.get(city.strip().casefold())
    if slug is None:
        return PlaceResearchResult(
            note="Direct listings are unavailable for this city; use web discovery."
        )
    cleaned = re.sub(re.escape(city), " ", query, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\b(?:концерт\w*|афиша|мероприят\w*|событи\w*|20\d\d)\b", " ", cleaned, flags=re.IGNORECASE
    )
    cleaned = " ".join(cleaned.split()) or query
    try:
        response = await client.get(
            "https://afisha.yandex.ru/search",
            params={"city": slug, "search-text": cleaned, "source": "suggest"},
        )
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise ValueError("Public event listing search is unavailable") from error
    if len(response.content) > 2_000_000:
        raise ValueError("Public event listing response exceeds the size limit")
    parser = PageText()
    parser.feed(response.text)
    tokens = [word.casefold()[:4] for word in re.findall(r"[^\W\d_]{3,}", cleaned)]
    records = {}
    for href, label in parser.links:
        if tokens and not any(word in label.casefold() for word in tokens):
            continue
        url = urlsplit(urljoin("https://afisha.yandex.ru", href))
        if url.hostname != "afisha.yandex.ru" or not re.fullmatch(
            rf"/{re.escape(slug)}/(?:concert|theatre|art|cinema|sport|excursions|standup)/[^/]+",
            url.path,
        ):
            continue
        canonical = urlunsplit((url.scheme, url.netloc, url.path, "", ""))
        records[canonical] = {"url": canonical, "title": label[:500], "snippet": label[:1000]}
    return PlaceResearchResult(
        records=tuple(records.values())[:8],
        sources=(str(response.url),),
        note="Public event listings; read each page before establishing date or venue.",
    )
