from hotel_agent.domain.room_views import declared_views, named_views


def test_declared_field_needs_no_view_marker() -> None:
    assert declared_views("на море") == ("sea",)
    assert declared_views("на парк: на море") == ("sea", "park")
    assert declared_views("на двор") == ("courtyard",)
    assert declared_views("на бассейн: на парк") == ("park", "pool")


def test_room_name_claims_a_view_only_when_it_says_so() -> None:
    assert named_views("Двухместный номер с видом на море") == ("sea",)
    assert named_views("Двухместный люкс Морской") == ()
    assert named_views("Стандарт, окна на горы") == ("mountain",)


def test_city_is_not_read_as_a_mountain() -> None:
    assert declared_views("на город") == ("city",)
    assert declared_views("на горы") == ("mountain",)
    assert declared_views("вид на горный хребет") == ("mountain",)


def test_a_palace_is_not_a_courtyard() -> None:
    assert declared_views("вид на дворец") == ()
    assert declared_views("во внутренний двор") == ("courtyard",)


def test_english_values_map_to_the_same_codes() -> None:
    assert declared_views("sea view") == ("sea",)
    assert named_views("Suite with pool view") == ("pool",)
    assert declared_views("panoramic") == ("panoramic",)


def test_sunrise_and_sunset_are_separate_targets() -> None:
    assert declared_views("на восход") == ("sunrise",)
    assert declared_views("на закат") == ("sunset",)
    assert declared_views("") == ()
