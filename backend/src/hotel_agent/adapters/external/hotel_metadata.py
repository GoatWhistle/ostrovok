import json
from collections.abc import Iterator
from html.parser import HTMLParser
from typing import Any

TYPES = frozenset({"Hotel", "LodgingBusiness", "Hostel", "Motel", "Resort", "BedAndBreakfast"})
FIELDS = frozenset(
    {
        "@type",
        "name",
        "url",
        "address",
        "geo",
        "telephone",
        "email",
        "amenityFeature",
        "aggregateRating",
        "image",
        "priceRange",
        "petsAllowed",
        "numberOfRooms",
        "checkinTime",
        "checkoutTime",
        "starRating",
        "hasMap",
        "smokingAllowed",
        "description",
    }
)
MAX_BLOCK = 64_000


class HotelMetadata(HTMLParser):
    def __init__(self, types: frozenset[str] = TYPES, fields: frozenset[str] = FIELDS) -> None:
        super().__init__()
        self._types, self._fields = types, fields
        self.records: list[dict[str, Any]] = []
        self._parts: list[str] | None = None
        self._length = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            attributes = dict(attrs)
            kind = (attributes.get("type") or "").split(";", 1)[0].strip().casefold()
            self._parts = [] if kind == "application/ld+json" else None
            self._length = 0

    def handle_data(self, data: str) -> None:
        if self._parts is not None:
            self._length += len(data)
            if self._length > MAX_BLOCK:
                self._parts = None
            else:
                self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "script" or self._parts is None:
            return
        raw = "".join(self._parts)
        self._parts = None
        if len(self.records) >= 10:
            return
        try:
            payload = json.loads(raw)
            for record in _hotels(payload, types=self._types):
                if len(self.records) >= 10:
                    break
                self.records.append(
                    {key: value for key, value in record.items() if key in self._fields}
                )
        except (ValueError, RecursionError):
            return

    def evidence(self) -> str:
        if not self.records:
            return ""
        text = json.dumps(self.records, ensure_ascii=False, indent=2)
        if len(text) > 16_000:
            return ""
        return "\nСтруктурированные сведения со страницы (непроверенные):\n" + text


def _hotels(
    value: object, depth: int = 0, types: frozenset[str] = TYPES
) -> Iterator[dict[str, Any]]:
    if depth > 8:
        return
    if isinstance(value, list):
        for item in value:
            yield from _hotels(item, depth + 1, types)
    elif isinstance(value, dict):
        kinds = value.get("@type", [])
        if isinstance(kinds, str):
            kinds = [kinds]
        if isinstance(kinds, list) and any(
            isinstance(kind, str) and kind.rsplit("/", 1)[-1] in types for kind in kinds
        ):
            yield value
        else:
            for key in ("@graph", "mainEntity", "itemListElement", "item"):
                if key in value:
                    yield from _hotels(value[key], depth + 1, types)
