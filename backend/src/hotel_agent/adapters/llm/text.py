import re

WORD = re.compile(r"[^\W_]+", re.UNICODE)
STOP_WORDS = frozenset(
    {
        "а",
        "бы",
        "в",
        "для",
        "до",
        "же",
        "и",
        "из",
        "или",
        "к",
        "на",
        "не",
        "но",
        "о",
        "от",
        "по",
        "с",
        "со",
        "у",
        "хочу",
        "чтобы",
        "я",
    }
)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold().replace("ё", "е")).strip()


def terms_outside(text: str, spans: list[tuple[int, int]]) -> tuple[str, ...]:
    found: list[str] = []
    for match in WORD.finditer(text):
        word = match.group()
        covered = any(start <= match.start() and match.end() <= end for start, end in spans)
        if covered or word in STOP_WORDS or word in found:
            continue
        found.append(word)
    return tuple(found)
