import math
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

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
        "dom",
        "d",
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
}


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelIdentity:
    name: str
    address: str | None
    location: tuple[float, float]
    country: str = "RU"

    def __post_init__(self) -> None:
        lon, lat = self.location
        if (
            not math.isfinite(lon)
            or not math.isfinite(lat)
            or not -180 <= lon <= 180
            or not -90 <= lat <= 90
        ):
            raise ValueError("Hotel coordinates must be finite WGS84 longitude and latitude")


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelCandidate:
    supplier_id: str
    identity: HotelIdentity


@dataclass(frozen=True, slots=True, kw_only=True)
class IdentityAssessment:
    candidate: HotelCandidate
    distance_m: float
    name_similarity: float
    address_status: str
    accepted: bool
    reason: str


def assess_identity(local: HotelIdentity, candidate: HotelCandidate) -> IdentityAssessment:
    remote = candidate.identity
    distance = distance_m(local.location, remote.location)
    local_name, remote_name = _name(local.name), _name(remote.name)
    similarity = SequenceMatcher(None, local_name, remote_name).ratio()
    address = _address_status(local.address, remote.address)
    exact = bool(local_name) and local_name == remote_name
    reason = "matched"
    if local.country.upper() != remote.country.upper():
        reason = "country_mismatch"
    elif distance > 300:
        reason = "too_far"
    elif not local_name or not remote_name:
        reason = "generic_name"
    elif address == "conflict":
        reason = "address_conflict"
    elif address == "confirmed" and (exact or similarity >= 0.9) or exact and distance <= 50:
        pass
    else:
        reason = "insufficient_identity_evidence"
    return IdentityAssessment(
        candidate=candidate,
        distance_m=distance,
        name_similarity=similarity,
        address_status=address,
        accepted=reason == "matched",
        reason=reason,
    )


def distance_m(left: tuple[float, float], right: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (*left, *right))
    value = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 6_371_008.8 * 2 * math.asin(math.sqrt(min(1, max(0, value))))


def _tokens(value: str) -> list[str]:
    ascii_text = unicodedata.normalize("NFKD", value.casefold().translate(TRANSLITERATION))
    ascii_text = "".join(char for char in ascii_text if not unicodedata.combining(char))
    return re.findall(r"[a-z0-9]+(?:[/\-][a-z0-9]+)*", ascii_text)


def _name(value: str) -> str:
    return " ".join(sorted(token for token in _tokens(value) if token not in NAME_WORDS))


def _address_status(left: str | None, right: str | None) -> str:
    if not left or not right:
        return "unknown"
    left_tokens, right_tokens = set(_tokens(left)), set(_tokens(right))
    left_types = {STREET_TYPES[token] for token in left_tokens if token in STREET_TYPES}
    right_types = {STREET_TYPES[token] for token in right_tokens if token in STREET_TYPES}
    if left_types and right_types and left_types.isdisjoint(right_types):
        return "conflict"
    local = left_tokens - ADDRESS_WORDS
    remote = right_tokens - ADDRESS_WORDS
    local_numbers = {token for token in local if token[0].isdigit()}
    remote_numbers = {token for token in remote if token[0].isdigit()}
    if local_numbers and remote_numbers and not local_numbers <= remote_numbers:
        return "conflict"
    local_street = local - local_numbers
    remote_street = remote - remote_numbers
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
