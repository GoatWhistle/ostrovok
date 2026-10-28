from hotel_agent.application.agent.stated_units import rescaled, stated


def test_a_stated_quantity_is_read_with_its_unit() -> None:
    assert stated("до моря не больше 3 секунд") == (3.0, "sec")
    assert stated("до моря 1,5 км") == (1.5, "km")
    assert stated("тихий номер") is None


def test_a_threshold_stated_in_another_unit_is_converted() -> None:
    assert rescaled("до моря не больше 3 секунд", "min", 3.0) == 0.05
    assert rescaled("до моря 1 км", "m", 1.0) == 1000.0
    assert rescaled("до моря не больше 2 часов", "min", 2.0) == 120.0


def test_a_threshold_already_in_the_native_unit_is_left_alone() -> None:
    assert rescaled("до моря не больше 10 минут", "min", 10.0) is None
    assert rescaled("до моря 500 метров", "m", 500.0) is None


def test_nothing_is_converted_without_a_matching_number_or_unit() -> None:
    assert rescaled("до моря не больше 3 секунд", "min", 7.0) is None
    assert rescaled("оценка не ниже 8", "score", 8.0) is None
    assert rescaled("нужен бассейн", "min", True) is None
    assert rescaled("до моря 5 минут", None, 5.0) is None
