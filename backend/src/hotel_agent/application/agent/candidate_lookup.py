import re
from collections import Counter
from collections.abc import Mapping, Sequence
from math import log
from typing import Any

from hotel_agent.application.agent.catalogue_links import reference_urls
from hotel_agent.application.dto import SearchHotelRecord


def words(text: str) -> set[str]:
    return set(re.findall(r"[^\W_]+", text.casefold().replace("ё", "е")))


IDENTITY_KEYS = {"name", "old_name", "alt_name", "official_name", "short_name", "addr", "wikipedia"}


def identity_tags(tags: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in tags.items()
        if key.split(":")[0] in IDENTITY_KEYS or key in {"website", "contact:website", "wikidata"}
    }


def lookup_candidates(
    hotels: Sequence[SearchHotelRecord],
    records: Sequence[dict[str, Any]],
    arguments: dict[str, Any],
) -> dict[str, Any]:
    offset, limit = int(arguments.get("offset") or 0), int(arguments.get("limit") or 12)
    if offset < 0 or not 1 <= limit <= 50:
        raise ValueError("Use a nonnegative offset and page size 1–50")
    metadata = {str(row["hotel_id"]): identity_tags(row.get("tags", {})) for row in records}
    indexed = {
        h.id: words(" ".join([h.name, h.address or "", *map(str, metadata.get(h.id, {}).values())]))
        for h in hotels
    }
    frequency = Counter(word for tokens in indexed.values() for word in tokens)
    wanted = words(str(arguments.get("query") or ""))
    scores = {
        h.id: sum(log(1 + len(hotels) / frequency[word]) for word in wanted & indexed[h.id])
        for h in hotels
    }
    ordered = sorted(hotels, key=lambda h: -scores[h.id]) if wanted else list(hotels)
    matched = [h for h in ordered if not wanted or scores[h.id] > 0]
    selected = matched[offset : offset + limit]
    return {
        "candidates": [
            {
                "hotel_id": h.id,
                "name": h.name,
                "address": h.address,
                "location": h.location,
                "identity_tags": metadata.get(h.id, {}),
                "reference_urls": reference_urls(metadata.get(h.id, {})),
            }
            for h in selected
        ],
        "total": len(matched),
        "next_offset": offset + len(selected) if offset + len(selected) < len(matched) else None,
        "discovery_only": True,
        "note": "Catalogue identity candidates only, not wish evidence. Compare names, aliases, address and source before attaching a web page. Shared words do not establish identity."
        " reference_urls are pages about this exact object: read them with its hotel_id before searching the open web for the name.",
    }
