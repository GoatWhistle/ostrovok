from dataclasses import replace
from typing import TypedDict, Unpack

import pytest

from hotel_agent.domain.hotel_identity import HotelCandidate, HotelIdentity, assess_identity

LOCAL = HotelIdentity(name="Маринс Парк Отель", address="улица Морская 12", location=(39.72, 43.58))


class IdentityChanges(TypedDict, total=False):
    name: str
    address: str | None
    location: tuple[float, float]
    country: str


def candidate(**changes: Unpack[IdentityChanges]) -> HotelCandidate:
    return HotelCandidate(supplier_id="supplier-1", identity=replace(LOCAL, **changes))


def test_transliterated_names_and_full_supplier_address_match() -> None:
    result = assess_identity(
        LOCAL, candidate(name="Marins Park Hotel", address="12 Morskaya Street, Sochi, Russia")
    )
    assert result.accepted
    assert result.address_status == "confirmed"
    assert result.distance_m == 0


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"location": (37.62, 55.75)}, "too_far"),
        ({"country": "TR"}, "country_mismatch"),
        ({"address": "Морская 13"}, "address_conflict"),
        ({"address": "Лесная 12"}, "address_conflict"),
        ({"address": "проспект Морская 12"}, "address_conflict"),
        ({"address": "Морская 12/1"}, "address_conflict"),
        ({"name": "Совсем другой отель"}, "insufficient_identity_evidence"),
    ],
)
def test_nearby_and_same_brand_are_not_sufficient(changes: IdentityChanges, reason: str) -> None:
    result = assess_identity(LOCAL, candidate(**changes))
    assert not result.accepted
    assert result.reason == reason


def test_exact_name_with_missing_address_requires_50_metre_proximity() -> None:
    local = replace(LOCAL, address=None)
    assert assess_identity(local, candidate(address=None)).accepted
    assert not assess_identity(local, candidate(address=None, location=(39.722, 43.58))).accepted


def test_fuzzy_name_requires_a_confirmed_address() -> None:
    remote = candidate(name="Marinz Park Hotel", location=(39.722, 43.58))
    assert assess_identity(LOCAL, remote).accepted
    assert not assess_identity(replace(LOCAL, address=None), remote).accepted


def test_generic_name_is_not_an_identity_even_at_the_same_address() -> None:
    local = replace(LOCAL, name="Гостевой дом")
    assert not assess_identity(local, candidate(name="Guest House")).accepted


@pytest.mark.parametrize("location", [(float("nan"), 50), (40, float("inf")), (181, 50), (40, -91)])
def test_invalid_coordinates_are_rejected(location: tuple[float, float]) -> None:
    with pytest.raises(ValueError, match="coordinates"):
        replace(LOCAL, location=location)
