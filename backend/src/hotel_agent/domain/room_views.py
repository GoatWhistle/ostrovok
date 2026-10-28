import re

VIEW_CODES: tuple[str, ...] = (
    "sea",
    "mountain",
    "city",
    "park",
    "garden",
    "courtyard",
    "pool",
    "river",
    "lake",
    "sunrise",
    "sunset",
    "panoramic",
)

_STEMS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("sea", ("море", "моря", "морем", "морск", "sea", "ocean")),
    ("mountain", ("гора", "горы", "горе", "горам", "горах", "горн", "mountain")),
    ("city", ("город", "городск", "city", "town")),
    ("park", ("парк", "park")),
    ("garden", ("сад", "garden")),
    ("courtyard", ("двор", "дворик", "дворы", "дворе", "courtyard", "patio")),
    ("pool", ("бассейн", "pool")),
    ("river", ("река", "реку", "реки", "реке", "речн", "river")),
    ("lake", ("озер", "lake")),
    ("sunrise", ("восход", "sunrise")),
    ("sunset", ("закат", "sunset")),
    ("panoramic", ("панорам", "panoram")),
)

_NOT_A_VIEW = frozenset({"дворец", "дворца", "дворцовый", "дворецкий", "садовод"})

_MARKERS = ("вид", "видом", "окна", "окнами", "окон", "выход", "view", "outlook", "facing")


def declared_views(*texts: str) -> tuple[str, ...]:
    return _codes(texts)


def named_views(*texts: str) -> tuple[str, ...]:
    marked = tuple(text for text in texts if _marked(text))
    return _codes(marked)


def _codes(texts: tuple[str, ...]) -> tuple[str, ...]:
    words = [word for text in texts for word in _words(text)]
    found = {
        code
        for code, stems in _STEMS
        for word in words
        if word not in _NOT_A_VIEW and word.startswith(stems)
    }
    return tuple(code for code in VIEW_CODES if code in found)


def _marked(text: str) -> bool:
    return any(word.startswith(_MARKERS) for word in _words(text))


def _words(text: str) -> list[str]:
    return re.findall(r"\w+", text.casefold().replace("ё", "е"))
