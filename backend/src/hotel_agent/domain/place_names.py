import re
import unicodedata
from dataclasses import dataclass

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
QUALIFIER_WORDS = frozenset(
    ("s", "k", "str", "korp", "korpus", "stroenie", "bld", "building", "lit", "litera")
)
BUILDING_SUFFIX = re.compile(
    r"^(\d{1,3})[a-z]?(?:s|k|str|korp|korpus|stroenie|bld|building|lit|litera)(\d{1,3})$"
)
HOUSE_SPLIT = re.compile(r"^(\d{1,3})[a-z]?[/-](\d{1,3})[a-z]?$")
HOUSE_PLAIN = re.compile(r"^(\d{1,3})[a-z]?(?:[/-][a-z]+)?$")
JOINED_BUILDING = re.compile(r"^(?:s|k|str|korp|korpus|stroenie|bld|building|lit|litera)(\d{1,3})$")


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


@dataclass(frozen=True, slots=True)
class House:
    number: str
    building: str | None = None


def _house(token: str) -> House | None:
    suffixed = BUILDING_SUFFIX.match(token)
    if suffixed is not None:
        return House(number=suffixed.group(1), building=suffixed.group(2))
    split = HOUSE_SPLIT.match(token)
    if split is not None:
        return House(number=split.group(1), building=split.group(2))
    plain = HOUSE_PLAIN.match(token)
    return House(number=plain.group(1)) if plain is not None else None


def _building_ahead(parts: list[str], index: int) -> tuple[str | None, int]:
    if index < len(parts):
        joined = JOINED_BUILDING.match(parts[index])
        if joined is not None:
            return joined.group(1), index + 1
        if (
            parts[index] in QUALIFIER_WORDS
            and index + 1 < len(parts)
            and parts[index + 1].isdigit()
        ):
            return parts[index + 1], index + 2
    return None, index


def house_entries(parts: list[str]) -> frozenset[House]:
    found: set[House] = set()
    index = 0
    while index < len(parts):
        house = _house(parts[index])
        index += 1
        if house is None:
            continue
        if house.building is None:
            building, index = _building_ahead(parts, index)
            house = House(number=house.number, building=building)
        found.add(house)
    return frozenset(found)


def house_numbers(parts: list[str]) -> frozenset[str]:
    return frozenset(house.number for house in house_entries(parts))


def house_conflict(left: frozenset[House], right: frozenset[House]) -> bool:
    if not left or not right:
        return False
    return not any(local == remote for local in left for remote in right)


def street_parts(parts: list[str]) -> frozenset[str]:
    return frozenset(
        token
        for token in parts
        if token not in ADDRESS_WORDS
        and not token[:1].isdigit()
        and HOUSE_QUALIFIER.match(token) is None
    )


def street_types(parts: list[str]) -> set[str]:
    found = set()
    for index, token in enumerate(parts):
        if token not in STREET_TYPES:
            continue
        if token in QUALIFIER_WORDS and index + 1 < len(parts) and parts[index + 1].isdigit():
            continue
        found.add(STREET_TYPES[token])
    return found


def address_status(left: str | None, right: str | None) -> str:
    if not left or not right:
        return "unknown"
    local_parts, remote_parts = tokens(left), tokens(right)
    left_types = street_types(local_parts)
    right_types = street_types(remote_parts)
    if left_types and right_types and left_types.isdisjoint(right_types):
        return "conflict"
    local_houses = house_entries(local_parts)
    remote_houses = house_entries(remote_parts)
    if house_conflict(local_houses, remote_houses):
        return "conflict"
    local_street = street_parts(local_parts)
    remote_street = street_parts(remote_parts)
    if (
        local_street
        and remote_street
        and not (local_street <= remote_street or remote_street <= local_street)
    ):
        return "conflict"
    if local_houses and remote_houses and local_street and local_street <= remote_street:
        return "confirmed"
    return "unknown"
