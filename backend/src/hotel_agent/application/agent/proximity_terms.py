import re

PREPOSITIONS = (
    "рядом со",
    "рядом с",
    "недалеко от",
    "неподалёку от",
    "неподалеку от",
    "поблизости от",
    "близко к",
    "вблизи",
    "около",
    "возле",
    "напротив",
    "у самого",
    "next to",
    "near",
)
TRAILING = re.compile(r"[\s,.;:!?«»\"']+$")


def named_place(term: str) -> str:
    text = " ".join(term.split())
    lowered = text.casefold()
    for preposition in PREPOSITIONS:
        start = lowered.find(preposition)
        if start < 0 or (start and lowered[start - 1].isalnum()):
            continue
        tail = text[start + len(preposition) :].strip()
        if tail and not tail[0].isalnum():
            continue
        return TRAILING.sub("", tail)
    return ""
