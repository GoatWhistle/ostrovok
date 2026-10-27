import math
from dataclasses import dataclass
from difflib import SequenceMatcher

from hotel_agent.domain.place_names import (
    NAME_WORDS,
    address_status,
    name_key,
    name_tokens,
)

EXACT_NAME_M = 150.0
COVERED_NAME_M = 60.0


@dataclass(frozen=True, slots=True, kw_only=True)
class HotelIdentity:
    name: str
    address: str | None
    location: tuple[float, float]
    country: str = "RU"
    city: str | None = None

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


def name_parts(value: str) -> frozenset[str]:
    return frozenset(token for token in name_tokens(value) if token not in NAME_WORDS)


def shared_identity(local: frozenset[str], remote: frozenset[str], place: str | None) -> bool:
    ignored = frozenset(name_tokens(place or ""))
    return any(len(token) >= 4 and not token[:1].isdigit() for token in (local & remote) - ignored)


def assess_identity(local: HotelIdentity, candidate: HotelCandidate) -> IdentityAssessment:
    remote = candidate.identity
    distance = distance_m(local.location, remote.location)
    local_name, remote_name = name_key(local.name), name_key(remote.name)
    similarity = SequenceMatcher(None, local_name, remote_name).ratio()
    address = address_status(local.address, remote.address)
    exact = bool(local_name) and local_name == remote_name
    local_parts, remote_parts = name_parts(local.name), name_parts(remote.name)
    consistent = bool(local_parts) and (local_parts <= remote_parts or remote_parts <= local_parts)
    covered = len(local_parts) >= 2 and local_parts <= remote_parts
    shared = shared_identity(local_parts, remote_parts, remote.city)
    confirmed = address == "confirmed" and (
        exact or consistent or similarity >= 0.8 or (shared and distance <= 60)
    )
    nearby = (exact and distance <= EXACT_NAME_M) or (covered and distance <= COVERED_NAME_M)
    reason = "matched"
    if local.country.upper() != remote.country.upper():
        reason = "country_mismatch"
    elif distance > 300:
        reason = "too_far"
    elif not local_name or not remote_name:
        reason = "generic_name"
    elif address == "conflict":
        reason = "address_conflict"
    elif not confirmed and not nearby:
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
