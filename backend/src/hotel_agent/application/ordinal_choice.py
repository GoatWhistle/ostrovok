from collections.abc import Mapping, Sequence

ORDINALS: Mapping[str, int] = {
    "перв": 0,
    "втор": 1,
    "трет": 2,
    "четверт": 3,
    "пят": 4,
    "first": 0,
    "second": 1,
    "third": 2,
    "fourth": 3,
    "fifth": 4,
}
LAST = ("последн", "last")


def chosen_hotel_id(message: str, snapshot: Mapping[str, object] | None) -> str | None:
    results = snapshot.get("results") if snapshot else None
    if not isinstance(results, Sequence) or not results:
        return None
    text = message.casefold().replace("ё", "е")
    index = _index(text, len(results))
    if index is None:
        return None
    row = results[index]
    hotel = row.get("hotel") if isinstance(row, Mapping) else None
    identifier = hotel.get("id") if isinstance(hotel, Mapping) else None
    return str(identifier) if identifier else None


def _index(text: str, count: int) -> int | None:
    if any(word in text for word in LAST):
        return count - 1
    for stem, position in ORDINALS.items():
        if stem in text and position < count:
            return position
    return None
