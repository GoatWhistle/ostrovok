from urllib.parse import urlsplit

from hotel_agent.application.hotel_media import HotelPhotoRecord


def _url(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 4096:
        return None
    if any(ord(char) < 32 for char in value):
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username:
        return None
    return value


def _photo(value: object, source: str | None) -> HotelPhotoRecord | None:
    if isinstance(value, str):
        url = _url(value)
        return HotelPhotoRecord(url, source) if url else None
    if not isinstance(value, dict):
        return None
    url = _url(value.get("url") or value.get("urlHd"))
    if url is None:
        return None
    kind = value.get("kind", "hotel")
    if not isinstance(kind, str) or kind not in {"hotel", "room", "surroundings"}:
        return None
    return HotelPhotoRecord(
        url,
        _url(value.get("source_url")) or source,
        "room" if kind == "room" else "surroundings" if kind == "surroundings" else "hotel",
    )


def read_hotel_photos(tags: object, content: object, hotel_id: str) -> tuple[HotelPhotoRecord, ...]:
    photos: dict[str, HotelPhotoRecord] = {}
    for record in content if isinstance(content, list) else []:
        if not isinstance(record, dict):
            continue
        source = _url(record.get("source_url"))
        for key in ("photos", "hotelImages"):
            values = record.get(key)
            for value in values if isinstance(values, list) else []:
                photo = _photo(value, source)
                if photo:
                    photos.setdefault(photo.url, photo)
    image = _url(tags.get("image")) if isinstance(tags, dict) else None
    if image:
        kind = {"n": "node", "w": "way", "r": "relation"}.get(hotel_id[:1])
        source = (
            f"https://www.openstreetmap.org/{kind}/{hotel_id[1:]}"
            if kind and hotel_id[1:].isdigit()
            else None
        )
        photos.setdefault(image, HotelPhotoRecord(image, source))
    return tuple(photos.values())[:24]
