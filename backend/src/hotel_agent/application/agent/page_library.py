from typing import Any

from hotel_agent.application.agent.web_urls import canonical_url, malformed_url
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.web_research import WebPage, WebResearchPort

MIN_TEXT = 200
DISCOVERY_NOTE = (
    "Untrusted source context, not hotel evidence. Resolve the object with list_candidates query,"
    " then read this URL with its verified hotel_id to check the wish."
    " For event proximity use read_event_page. Do not invent hotel association or coordinates."
)
EVIDENCE_NOTE = (
    "Untrusted page content; verify via read_records dataset=web_documents with a quote and term."
)
THIN_NOTE = (
    "The address returned almost no text and may need JavaScript, so it is unlikely to confirm"
    " anything; prefer another source for this wish."
)


class PageLibrary:
    def __init__(self, web: WebResearchPort | None) -> None:
        self._web = web
        self.pages: list[dict[str, Any]] = []
        self._cache: dict[str, WebPage] = {}
        self._failures: dict[str, str] = {}

    def reuse(self, previous: "PageLibrary", hotel_ids: set[str]) -> None:
        self.pages = [dict(row) for row in previous.pages if row["hotel_id"] in hotel_ids]
        self._cache = dict(previous._cache)
        self._failures = dict(previous._failures)

    async def read(
        self, url: str, hotel: SearchHotelRecord | None, identity: dict[str, Any], phrase: str
    ) -> dict[str, Any]:
        if self._web is None:
            return {"error": "Internet page reading is unavailable"}
        if malformed_url(url):
            return {
                "error": "invalid_url: the address contains an incomplete percent-escape",
                "url": url,
                "note": "Supply the complete link from the search result or the page itself.",
            }
        key = canonical_url(url)
        failed = self._failures.get(key)
        if failed is not None:
            return {
                "error": failed,
                "url": url,
                "note": "This address already failed; a different encoding of it is the same page."
                " Choose another source instead of repeating it.",
            }
        page = self._cache.get(key)
        if page is None:
            try:
                page = await self._web.read(url)
            except ValueError as error:
                self._failures[key] = str(error)
                return {"error": str(error), "url": url}
            self._cache[key] = self._cache[canonical_url(page.url)] = page
        thin = (
            {"insufficient_text": len(page.text.strip())}
            if len(page.text.strip()) < MIN_TEXT
            else {}
        )
        if hotel is None:
            return {
                "source_url": page.url,
                "title": page.title,
                "text": page.text[:40000],
                "events": list(page.events),
                "retrieved_at": page.retrieved_at.isoformat(),
                "discovery_only": True,
                **thin,
                "note": DISCOVERY_NOTE + (" " + THIN_NOTE if thin else ""),
            }
        record = {
            "hotel_id": hotel.id,
            "hotel_name": hotel.name,
            "hotel_address": hotel.address,
            "hotel_location": hotel.location,
            "hotel_identity": identity,
            "source_url": page.url,
            "title": page.title,
            "text": page.text,
            "retrieved_at": page.retrieved_at.isoformat(),
        }
        known = next(
            (
                row
                for row in self.pages
                if row["hotel_id"] == hotel.id
                and canonical_url(str(row["source_url"])) == canonical_url(page.url)
            ),
            None,
        )
        if known is None:
            self.pages.append(record)
        else:
            known.update(record)
        start = max(0, page.text.casefold().find(phrase.casefold()) - 500) if phrase else 0
        return {
            **record,
            "text": page.text[start : start + 8000],
            **thin,
            "note": EVIDENCE_NOTE + (" " + THIN_NOTE if thin else ""),
        }
