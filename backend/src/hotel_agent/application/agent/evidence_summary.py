import re
from collections.abc import Iterable, Sequence
from urllib.parse import urlsplit

MAX_LENGTH = 180
QUOTE_LENGTH = 110
LABEL_LENGTH = 70
OPERATORS = {"gte": "не менее", "lte": "не более", "eq": "равно"}
CONFIRMED = "Подтверждено источником"
QUOTED = "Подтверждено"
TIMESTAMP = "; retrieved_at="
SENTENCE = re.compile(r"(?<=[.!?…])\s+")


def compress(text: str) -> str:
    return " ".join(str(text).split())


def shorten(text: str, limit: int) -> str:
    compressed = compress(text)
    if len(compressed) <= limit:
        return compressed
    head = compressed[:limit]
    if " " in head:
        head = head[: head.rindex(" ")]
    return head.rstrip(" ,;:.!?-") + "…"


def summary(clauses: Iterable[str], limit: int = MAX_LENGTH) -> str:
    selected: list[str] = []
    for clause in clauses:
        text = compress(clause).rstrip(".")
        if not text or text in selected:
            continue
        if selected and len(". ".join([*selected, text])) + 1 > limit:
            continue
        selected.append(text)
    if not selected:
        return ""
    if len(selected[0]) + 1 > limit:
        return shorten(selected[0], limit)
    return ". ".join(selected) + "."


def brief(text: str, limit: int = MAX_LENGTH) -> str:
    return summary(SENTENCE.split(compress(text)), limit)


def quoted(text: str, limit: int = QUOTE_LENGTH) -> str:
    inner = shorten(compress(text).strip("«»\"' "), limit)
    return f"«{inner}»" if inner else ""


def host(url: str) -> str:
    name = urlsplit(url).netloc.lower()
    return name.removeprefix("www.")


def sources(urls: Sequence[str], limit: int = 2) -> str:
    hosts = [name for name in dict.fromkeys(host(url) for url in urls) if name]
    if not hosts:
        return ""
    label = "Источник: " if len(hosts) == 1 else "Источники: "
    rest = len(hosts) - limit
    return label + ", ".join(hosts[:limit]) + (f" и ещё {rest}" if rest > 0 else "")


def field_label(description: str) -> str:
    return shorten(compress(description).split(TIMESTAMP)[0].rstrip("; "), LABEL_LENGTH)


def confirmation(description: str) -> bool:
    return compress(description).startswith("Подтвержден")


def measured(description: str, value: float, op: str, threshold: float) -> str:
    label = field_label(description)
    condition = (
        ""
        if op == "eq" and value == threshold
        else f" (нужно {OPERATORS.get(op, OPERATORS['eq'])} {threshold:g})"
    )
    if confirmation(description) and threshold <= 1 and op != "lte":
        return CONFIRMED
    return f"{label}: {value:g}{condition}"
