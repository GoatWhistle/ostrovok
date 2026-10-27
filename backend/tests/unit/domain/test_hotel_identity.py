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


def test_exact_name_with_missing_address_requires_close_proximity() -> None:
    local = replace(LOCAL, address=None)
    assert assess_identity(local, candidate(address=None)).accepted
    assert not assess_identity(local, candidate(address=None, location=(39.722, 43.58))).accepted


def test_passage_abbreviation_matches_without_accepting_a_different_street_type() -> None:
    local = replace(LOCAL, name="Метрополь", address="Театральный проезд 2")
    remote = HotelCandidate(
        supplier_id="7595994",
        identity=replace(local, name="Отель Метрополь", address="Театральный пр-д, д.2, Москва"),
    )
    assert assess_identity(local, remote).accepted
    wrong_street = replace(remote, identity=replace(remote.identity, address="Театральная улица 2"))
    assert assess_identity(local, wrong_street).reason == "address_conflict"


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


def test_building_suffix_formatting_is_the_same_address() -> None:
    local = replace(LOCAL, name="Cosmos", address="улица Горького 56 с1")
    remote = HotelCandidate(
        supplier_id="9986868",
        identity=replace(local, name="Cosmos Сочи Отель", address="улица Горького, д. 56с1, Сочи"),
    )
    result = assess_identity(local, remote)
    assert result.address_status == "confirmed"
    assert result.accepted


def test_supplier_decorations_do_not_hide_a_confirmed_address() -> None:
    local = replace(LOCAL, name="Azimut Парк Отель Виноградная", address="Виноградная улица 101/1")
    remote = HotelCandidate(
        supplier_id="13429040",
        identity=replace(
            local,
            name="AZIMUT Парк Отель Виноградная Сочи 4*",
            address="Виноградная улица, 101/1, Сочи",
            city="Сочи",
        ),
    )
    assert assess_identity(local, remote).accepted


def test_latin_and_cyrillic_spelling_of_the_same_name_match() -> None:
    local = replace(LOCAL, name="Karat-apart", address="улица Партизана Железняка 38")
    remote = HotelCandidate(
        supplier_id="11339347",
        identity=replace(
            local,
            name="Апарт-отель Карат Апарт",
            address="улица Партизана Железняка, 38, Красноярск",
        ),
    )
    assert assess_identity(local, remote).accepted


def test_shared_name_token_at_a_confirmed_address_is_accepted_only_nearby() -> None:
    local = replace(LOCAL, name="Four Elements Perm", address="улица Мира 45Б")
    remote = HotelCandidate(
        supplier_id="7383160",
        identity=replace(
            local, name="Отель Elements Пермь 4", address="улица Мира, д. 45б, Пермь", city="Пермь"
        ),
    )
    assert assess_identity(local, remote).accepted
    far = replace(remote, identity=replace(remote.identity, location=(39.7225, 43.58)))
    assert not assess_identity(local, far).accepted


def test_city_in_both_names_is_not_identity_evidence() -> None:
    local = replace(LOCAL, name="Kravt Hotel Kazan Airport", address=None)
    remote = HotelCandidate(
        supplier_id="10001647",
        identity=replace(
            local, name="Отель Muse of City Казань", address="улица Выставочная 3", city="Казань"
        ),
    )
    assert not assess_identity(local, remote).accepted


def test_square_abbreviation_is_the_same_address_type() -> None:
    local = replace(LOCAL, name="Юбилейная", address="площадь Ленина 1")
    remote = HotelCandidate(
        supplier_id="7041209",
        identity=replace(
            local,
            name="Гостиница Юбилейная",
            address="пл. Ленина, д. 1, Благовещенск",
            city="Благовещенск",
        ),
    )
    result = assess_identity(local, remote)
    assert result.address_status == "confirmed"
    assert result.accepted
    other_type = replace(
        remote, identity=replace(remote.identity, address="улица Ленина, д. 1, Благовещенск")
    )
    assert assess_identity(local, other_type).reason == "address_conflict"


def test_lodging_kind_words_do_not_make_two_spellings_different_hotels() -> None:
    local = replace(LOCAL, name="Мишель", address=None)
    remote = HotelCandidate(
        supplier_id="6415753",
        identity=replace(local, name="Меблированные комнаты Мишель", address=None),
    )
    assert assess_identity(local, remote).accepted
