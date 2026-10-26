from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from hotel_agent.adapters.external.ostrovok_rates import site_offers
from hotel_agent.application.ports.hotel_offers import OfferLookup


def site_content(row: dict[str, Any], checked_at: datetime) -> OfferLookup:
    info = row["static_vm"]
    filters = info.get("serp_filters", [])
    facilities = (
        tuple(x for x in filters if isinstance(x, str)) if isinstance(filters, list) else ()
    )
    groups = info.get("room_groups", [])
    categories: list[str] = []
    for group in groups if isinstance(groups, list) else []:
        name = group.get("name_struct") if isinstance(group, dict) else None
        if isinstance(name, dict) and isinstance(name.get("main_name"), str):
            parts = [name["main_name"], name.get("bedding_type")]
            categories.append(", ".join(x for x in parts if isinstance(x, str) and x.strip()))
    images = info.get("images", [])
    photo = None
    for item in images if isinstance(images, list) else []:
        url = item.get("tmpl") if isinstance(item, dict) else None
        if not isinstance(url, str):
            continue
        parsed = urlsplit(url)
        if parsed.scheme == "https" and parsed.hostname == "cdn.ostrovok.ru":
            photo = url.replace("{size}", "640x400")
            break
    return OfferLookup(
        offers=site_offers(row),
        checked_at=checked_at,
        facilities=tuple(dict.fromkeys(facilities)),
        room_categories=tuple(dict.fromkeys(categories)),
        photo_url=photo,
    )
