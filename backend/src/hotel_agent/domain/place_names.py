import re
import unicodedata

TRANSLITERATION = str.maketrans(
    dict(
        zip(
            "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
            (
                "a",
                "b",
                "v",
                "g",
                "d",
                "e",
                "e",
                "zh",
                "z",
                "i",
                "y",
                "k",
                "l",
                "m",
                "n",
                "o",
                "p",
                "r",
                "s",
                "t",
                "u",
                "f",
                "kh",
                "ts",
                "ch",
                "sh",
                "shch",
                "",
                "y",
                "",
                "e",
                "yu",
                "ya",
            ),
            strict=True,
        )
    )
)
NAME_WORDS = frozenset(
    (
        "hotel",
        "otel",
        "gostinitsa",
        "gostinichnyy",
        "kompleks",
        "spa",
        "resort",
        "hostel",
        "khostel",
        "guest",
        "house",
        "gostevoy",
        "dom",
        "the",
        "otelya",
        "apart",
        "mini",
        "meblirovannye",
        "komnaty",
        "baza",
        "otdykha",
        "pansionat",
        "sanatoriy",
        "glemping",
    )
)
ADDRESS_WORDS = frozenset(
    (
        "ulitsa",
        "ul",
        "street",
        "st",
        "str",
        "prospekt",
        "pr",
        "avenue",
        "pereulok",
        "per",
        "lane",
        "naberezhnaya",
        "embankment",
        "shosse",
        "highway",
        "proezd",
        "pr-d",
        "ploshchad",
        "square",
        "bulvar",
        "boulevard",
        "alleya",
        "alley",
        "tupik",
        "liniya",
        "trakt",
        "dom",
        "d",
        "zd",
        "russia",
        "rossiya",
    )
)
STREET_TYPES = {
    **dict.fromkeys(("ulitsa", "ul", "street", "st", "str"), "street"),
    **dict.fromkeys(("prospekt", "pr", "avenue"), "avenue"),
    **dict.fromkeys(("pereulok", "per", "lane"), "lane"),
    **dict.fromkeys(("naberezhnaya", "embankment"), "embankment"),
    **dict.fromkeys(("shosse", "highway"), "highway"),
    **dict.fromkeys(("proezd", "pr-d"), "passage"),
    **dict.fromkeys(("ploshchad", "pl", "square"), "square"),
    **dict.fromkeys(("bulvar", "b-r", "boulevard"), "boulevard"),
    **dict.fromkeys(("alleya", "alley"), "alley"),
    **dict.fromkeys(("tupik",), "deadend"),
    **dict.fromkeys(("liniya",), "line"),
    **dict.fromkeys(("trakt",), "tract"),
}
HOUSE_QUALIFIER = re.compile(r"^(?:s|k|str|korp|korpus|stroenie|bld|building|lit|litera)\d*$")
NUMBERED_QUALIFIER = re.compile(r"^(?:s|k|str|korp|korpus|stroenie|bld|building)\d+$")


def tokens(value: str) -> list[str]:
    ascii_text = unicodedata.normalize("NFKD", value.casefold().translate(TRANSLITERATION))
    ascii_text = "".join(char for char in ascii_text if not unicodedata.combining(char))
    return re.findall(r"[a-z0-9]+(?:[/\-][a-z0-9]+)*", ascii_text)


def name_tokens(value: str) -> list[str]:
    found: list[str] = []
    for token in tokens(value):
        found.extend(part for part in re.split(r"[/-]", token) if part)
    return found


def name_key(value: str) -> str:
    return " ".join(sorted(token for token in name_tokens(value) if token not in NAME_WORDS))


def house_numbers(parts: list[str]) -> frozenset[str]:
    found = set()
    index = 0
    while index < len(parts):
        token = parts[index]
        index += 1
        if not token[:1].isdigit():
            continue
        while index < len(parts) and NUMBERED_QUALIFIER.match(parts[index]):
            token += parts[index]
            index += 1
        found.add(token)
    return frozenset(found)


def street_parts(parts: list[str]) -> frozenset[str]:
    return frozenset(
        token
        for token in parts
        if token not in ADDRESS_WORDS
        and not token[:1].isdigit()
        and HOUSE_QUALIFIER.match(token) is None
    )


def address_status(left: str | None, right: str | None) -> str:
    if not left or not right:
        return "unknown"
    local_parts, remote_parts = tokens(left), tokens(right)
    left_types = {STREET_TYPES[token] for token in local_parts if token in STREET_TYPES}
    right_types = {STREET_TYPES[token] for token in remote_parts if token in STREET_TYPES}
    if left_types and right_types and left_types.isdisjoint(right_types):
        return "conflict"
    local_numbers = house_numbers([token for token in local_parts if token not in ADDRESS_WORDS])
    remote_numbers = house_numbers([token for token in remote_parts if token not in ADDRESS_WORDS])
    if local_numbers and remote_numbers and local_numbers.isdisjoint(remote_numbers):
        return "conflict"
    local_street = street_parts(local_parts)
    remote_street = street_parts(remote_parts)
    if (
        local_street
        and remote_street
        and not (local_street <= remote_street or remote_street <= local_street)
    ):
        return "conflict"
    if (
        local_numbers
        and local_numbers <= remote_numbers
        and local_street
        and local_street <= remote_street
    ):
        return "confirmed"
    return "unknown"
