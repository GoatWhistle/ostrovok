import json
import math
import re
from typing import Any
from urllib.parse import urlsplit

from hotel_agent.application.ports.hotel_offers import SupplierRoom
from hotel_agent.domain.room_views import VIEW_CODES, declared_views, named_views


def photo_urls(values: object) -> tuple[str, ...]:
    photos = []
    for item in values if isinstance(values, list) else []:
        url = item.get("tmpl") if isinstance(item, dict) else None
        if isinstance(url, str):
            parsed = urlsplit(url)
            if parsed.scheme == "https" and parsed.hostname == "cdn.ostrovok.ru":
                photos.append(url.replace("{size}", "1024x768"))
    return tuple(dict.fromkeys(photos))


def page_hotel(html: str, hotel_id: str, master_id: int) -> dict[str, Any]:
    script = re.search(r'<script\s+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if script is None:
        raise ValueError("Missing hotel page data")
    hotel = json.loads(script.group(1))["props"]["pageProps"]["hotel"]
    if not isinstance(hotel, dict):
        raise TypeError("Invalid hotel page")
    if hotel.get("id") != hotel_id or str(hotel.get("masterId")) != str(master_id):
        raise ValueError("Hotel page identity mismatch")
    return hotel


def room_groups(hotel: dict[str, Any]) -> tuple[SupplierRoom, ...]:
    groups = hotel.get("roomGroups")
    if not isinstance(groups, list):
        raise TypeError("Missing room groups")
    result = {}
    for group in groups:
        name = group["nameStruct"]
        room_id, title = group["rgHash"], name["mainName"]
        if not isinstance(room_id, str) or not isinstance(title, str) or not room_id or not title:
            raise ValueError("Invalid room identity")
        size = group.get("size")
        size = (
            float(size)
            if isinstance(size, (float, int))
            and not isinstance(size, bool)
            and math.isfinite(size)
            and size > 0
            else None
        )
        amenities = group.get("roomAmenityData", [])
        if not isinstance(amenities, list) or any(not isinstance(x, str) for x in amenities):
            raise ValueError("Invalid room amenities")
        bedding = name.get("beddingType")
        views = room_views(title, tuple(amenities))
        result[room_id] = SupplierRoom(
            id=room_id,
            name=title,
            photos=photo_urls(group.get("images")),
            amenities=tuple(amenities),
            size_sqm=size,
            bedding=bedding if isinstance(bedding, str) and bedding else None,
            views=views,
        )
    return tuple(result.values())


def room_views(title: str, amenities: tuple[str, ...]) -> tuple[str, ...]:
    coded = declared_views(*(code.replace("-", " ") for code in amenities if "view" in code))
    found = set(named_views(title)) | set(coded)
    return tuple(code for code in VIEW_CODES if code in found)
